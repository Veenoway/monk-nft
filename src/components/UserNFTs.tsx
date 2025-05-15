"use client";
import { useNFT } from "@/hooks/useNFTInteraction";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

export function UserNFTs() {
  const { refreshUserNFTs, userNFTs, isLoadingNFTs } = useNFT();
  const { address } = useAccount();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (address && !hasInitialized.current) {
      console.log("Initial NFT loading");
      refreshUserNFTs().then(() => {
        hasInitialized.current = true;
      });
    }
  }, [address, refreshUserNFTs]);

  const handleRefresh = async () => {
    if (isLoadingNFTs) {
      return;
    }

    try {
      console.log("Manual NFT refresh");
      await refreshUserNFTs();
    } catch (error) {
      console.error("Error refreshing NFTs:", error);
    }
  };

  if (!address) {
    return (
      <div className="mt-10">
        <h2 className="text-3xl sm:text-6xl font-bold text-white mb-4">
          My NFTs (0)
        </h2>
        <div className="h-48 flex items-center justify-center">
          <p className="text-[rgba(255,255,255,1)] uppercase text-xl sm:text-3xl">
            Connect your wallet to see your NFTs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl sm:text-6xl font-bold text-white uppercase">
          My NFTs ({userNFTs.length || 0})
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className={`${
              isLoadingNFTs
                ? "bg-[rgba(255,255,255,0.1)] cursor-not-allowed"
                : "bg-brandColor hover:bg-[#6C07D1]"
            } px-6 py-2 rounded text-2xl flex uppercase transition-all duration-300 ease-in-out items-center gap-2`}
            disabled={isLoadingNFTs}
          >
            {isLoadingNFTs && (
              <div className="animate-spin mr-2 ">
                <svg
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  className="animate-spin"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke={"currentColor"}
                    strokeWidth={2}
                  />
                  <path
                    className="opacity-75"
                    fill={"currentColor"}
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}
            Refresh
          </button>
        </div>
      </div>

      {userNFTs && userNFTs.length > 0 ? (
        <div className="grid grid-cols-1 mt-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {userNFTs.map((nft) => {
            const tokenId = nft.tokenId.toString();
            const nftName = nft.metadata?.name || `NFT #${tokenId}`;
            return (
              <div
                key={`nft-${tokenId}`}
                className="relative transition-all duration-500 rounded-lg transform hover:scale-105"
              >
                <div className="bg-[rgba(255,255,255,0.1)] backdrop-blur-md rounded-lg overflow-hidden">
                  <div className="relative w-full h-auto">
                    <img
                      src={nft.normalizedImage}
                      alt={nftName}
                      width={400}
                      height={262}
                      className="w-full h-[230px] object-cover"
                    />

                    {!nft.metadata && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="text-yellow-300 animate-pulse">
                          Loading...
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-2">
                    <h3 className="text-white text-2xl uppercase font-bold">
                      {nftName}
                    </h3>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center">
          {isLoadingNFTs ? (
            <div className="flex flex-col items-center">
              <p className="text-[rgba(255,255,255,0.7)] text-xl">
                Loading your NFTs...
              </p>
            </div>
          ) : (
            <p className="text-white uppercase text-3xl">
              No NFTs found. You can try refreshing the collection.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
