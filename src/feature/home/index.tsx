"use client";
import { WalletModal } from "@/components/connect-modal";
import { UserNFTs } from "@/components/UserNFTs";
import { useNFT } from "@/hooks/useNFTInteraction";
import { useEffect, useRef, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";

// Composant de compte à rebours
// function CountdownTimer({ currentPhase }: { currentPhase?: string }) {
//   const [timeRemaining, setTimeRemaining] = useState<{
//     days: number;
//     hours: number;
//     minutes: number;
//     seconds: number;
//   }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

//   useEffect(() => {
//     const getTargetDate = () => {
//       const whitelistEndDate = new Date("2025-04-04T13:00:00Z");

//       const fcfsEndDate = new Date("2025-04-05T13:00:00Z");

//       if (currentPhase === "Whitelist" || currentPhase === "OG_SALE") {
//         return whitelistEndDate;
//       } else if (currentPhase === "First Come First Served") {
//         return fcfsEndDate;
//       }

//       return whitelistEndDate;
//     };

//     const calculateTimeRemaining = () => {
//       const targetDate = getTargetDate();
//       const now = new Date();
//       const difference = targetDate.getTime() - now.getTime();

//       if (difference <= 0) {
//         return { days: 0, hours: 0, minutes: 0, seconds: 0 };
//       }

//       const days = Math.floor(difference / (1000 * 60 * 60 * 24));
//       const hours = Math.floor(
//         (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
//       );
//       const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
//       const seconds = Math.floor((difference % (1000 * 60)) / 1000);

//       return { days, hours, minutes, seconds };
//     };

//     const timer = setInterval(() => {
//       setTimeRemaining(calculateTimeRemaining());
//     }, 1000);

//     setTimeRemaining(calculateTimeRemaining());

//     return () => clearInterval(timer);
//   }, [currentPhase]);

//   const formatNumber = (num: number) => (num < 10 ? `0${num}` : num);

//   return (
//     <div className="flex items-center gap-1 sm:gap-2 uppercase">
//       {timeRemaining.days > 0 && <span>{timeRemaining.days}d</span>}
//       <span>{formatNumber(timeRemaining.hours)}h</span>
//       <span>{formatNumber(timeRemaining.minutes)}m</span>
//       <span>{formatNumber(timeRemaining.seconds)}s</span>
//     </div>
//   );
// }

export function NFT() {
  const { address, chainId, isDisconnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const isWrongNetwork = chainId !== 10143;
  const [open, setOpen] = useState(false);
  const [mintingStep, setMintingStep] = useState<
    "idle" | "preparing" | "confirming" | "success" | "error"
  >("idle");
  const [, setLastMintedNFT] = useState<{
    id: string;
    image: string;
  } | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showInfoPopup, setShowInfoPopup] = useState(true);

  const {
    maxSupply,
    totalMinted,
    isPaused,
    mint,
    isSuccess: isMintSuccess,
    userMintStatus,
    mintPhaseInfo,
    refreshUserNFTs,
    lastMintedTokenId,
    isUserWL,
    mintPrice,
    isUserFCFS,
    isUserTeam,
  } = useNFT();

  const canCurrentlyMint = userMintStatus?.canCurrentlyMint;
  const userMints = userMintStatus?.mintsDone || 0;
  const maxMintsPerAddress = userMintStatus?.mintsAllowed || 1;
  const userStatusInfo = userMintStatus?.userStatus || "";
  const isWhitelisted =
    userStatusInfo.includes("WHITELIST") || userStatusInfo.includes("OG");
  const whitelistOnly =
    mintPhaseInfo?.currentPhase === "WHITELIST" ||
    mintPhaseInfo?.currentPhase === "OG_SALE";

  const handleSwitchNetwork = async () => {
    try {
      await switchChainAsync({ chainId: 10143 });
    } catch (error) {
      console.error("Network switching error:", error);
    }
  };

  const handleMint = async () => {
    try {
      setMintingStep("preparing");

      if (chainId !== 10143) {
        await handleSwitchNetwork();
        return;
      }

      const result = await mint(false);
      setMintingStep("confirming");

      if (result && result.success) {
        setMintingStep("success");

        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }

        successTimeoutRef.current = setTimeout(() => {
          setMintingStep("idle");
          successTimeoutRef.current = null;
        }, 3000);

        setTimeout(() => {
          if (lastMintedTokenId) {
            setLastMintedNFT({
              id: String(lastMintedTokenId),
              image: "/placeholder-nft.png",
            });
          } else {
            checkForNFTMetadata();
          }

          if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
            successTimeoutRef.current = null;
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Mint error:", error);
    }
  };

  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 2;

  const checkForNFTMetadata = async () => {
    if (attempts >= MAX_ATTEMPTS) {
      if (lastMintedTokenId) {
        setLastMintedNFT({
          id: String(lastMintedTokenId),
          image: "/placeholder-nft.png",
        });
      } else if (totalMinted) {
        const tokenId = Number(totalMinted) - 1;
        setLastMintedNFT({
          id: String(tokenId),
          image: "/placeholder-nft.png",
        });
      }
      return;
    }

    setAttempts((prev) => prev + 1);

    try {
      await refreshUserNFTs();

      if (lastMintedTokenId) {
        setLastMintedNFT({
          id: String(lastMintedTokenId),
          image: "/placeholder-nft.png",
        });
        return;
      }

      if (totalMinted) {
        const tokenId = Number(totalMinted) - 1;
        setLastMintedNFT({
          id: String(tokenId),
          image: "/placeholder-nft.png",
        });
      } else {
        setLastMintedNFT({
          id: "?",
          image: "/placeholder-nft.png",
        });
      }
    } catch (error) {
      console.error("Error checking NFT metadata:", error);
      setLastMintedNFT({
        id: lastMintedTokenId ? String(lastMintedTokenId) : "?",
        image: "/placeholder-nft.png",
      });
    }
  };

  useEffect(() => {
    if (isMintSuccess) {
      setMintingStep("success");

      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }

      successTimeoutRef.current = setTimeout(() => {
        setMintingStep("idle");
        successTimeoutRef.current = null;
      }, 3000);
    }
  }, [isMintSuccess]);

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const isSoldOut = totalMinted >= maxSupply;
  const userCanMint =
    canCurrentlyMint && !isPaused && (!whitelistOnly || isWhitelisted);

  useEffect(() => {
    const hasSeenPopup = localStorage.getItem("hasSeenCollectionInfoPopup");
    if (hasSeenPopup) {
      setShowInfoPopup(false);
    }
  }, []);

  const handleCloseInfoPopup = () => {
    setShowInfoPopup(false);
    localStorage.setItem("hasSeenCollectionInfoPopup", "true");
  };

  return (
    <>
      {showInfoPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-brandColor border border-[rgba(255,255,255,0.1)] rounded-lg max-w-md w-[90%] p-6 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl sm:text-4xl font-bold text-white uppercase">
                Collection Privacy
              </h2>
              <button
                onClick={handleCloseInfoPopup}
                className="text-white/70 hover:text-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="mb-6 uppercase sm:text-2xl text-lg">
              <p className="text-white/90 mb-4">
                Your collection will remain private until the entire collection
                is sold out.
              </p>
              <p className="text-white/90 mb-4">
                No one will be able to see which NFTs you own until the
                collection reaches sold out status.
              </p>
              <p className="text-white/70">
                This is a security measure to protect the rarity and exclusivity
                of the collection.
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleCloseInfoPopup}
                className="bg-brandColor rounded px-6 py-3 text-lg uppercase text-white transition-all duration-300 ease-in-out hover:bg-opacity-80"
              >
                I understand
              </button>
            </div>
          </div>
        </div>
      )}

      <main
        className="min-h-screen w-screen text-white flex flex-col sm:pt-0 transition-all duration-1000 ease-in-out"
        style={{
          background:
            "url('https://pbs.twimg.com/media/GnI2BUfbgAkdTib?format=jpg&name=large')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="max-w-[1100px] w-[90%] mx-auto mt-[100px] lg:mt-[200px] flex lg:flex-row flex-col items-center lg:justify-between">
          <img
            src="/preview.gif"
            className="lg:h-[500px] lg:w-[500px] lg:mr-5 bg-secondary rounded-[10px]"
            alt="Spikynads Chad logo"
            style={{
              boxShadow: "0px 0px 13px 5px rgba(255, 255, 255, 0.1)",
            }}
          />
          <div className="max-w-[510px] flex flex-col lg:items-start items-center text-white font-medium text-xl lg:mt-0 mt-10">
            <h1 className="text-3xl text-center uppercase lg:text-start lg:text-7xl lg:leading-[70px] text-white font-bold">
              LIL MONKS
            </h1>
            <p className="text-[rgba(255,255,255,0.9)] text-center sm:text-start uppercase font-thin mt-4 mb-3 text-lg sm:text-2xl">
              EVERY LIL MONK CARRY AND UNLIMITED AMOUNT OF POWER, USE IT WISELY.
              DON&apos;T WAIT FOR TOMORROW, OWN YOUR FUTURE TODAY.
            </p>

            {address && isWrongNetwork ? (
              <button
                className="bg-brandColor flex items-center rounded w-fit h-[40px] sm:h-[45px] border border-[rgba(255,255,255,0.1)] px-4 py-5 text-2xl uppercase text-white transition-all font-thin duration-300 ease-in-out mx-auto lg:ml-0 lg:mr-auto mt-3"
                onClick={handleSwitchNetwork}
              >
                Switch Network
              </button>
            ) : null}

            {!address && (
              <WalletModal open={open} setOpen={setOpen}>
                <button
                  onClick={() => setOpen(true)}
                  className="bg-brandColor flex items-center rounded w-fit h-[40px] sm:h-[45px] border border-[rgba(255,255,255,0.1)] px-4 py-5 text-2xl uppercase text-white transition-all font-thin duration-300 ease-in-out mx-auto lg:ml-0 lg:mr-auto mt-3"
                >
                  Connect Wallet
                </button>
              </WalletModal>
            )}

            {address && !isWrongNetwork && (
              <div className="flex items-center flex-col lg:flex-row gap-3 mt-3 mb-0 uppercase">
                {isSoldOut ? (
                  <button className="bg-gray-600 flex items-center rounded w-fit h-[40px] sm:h-[45px] border border-[rgba(255,255,255,0.1)] px-4 py-5 text-2xl uppercase text-white transition-all font-thin duration-300 ease-in-out mx-auto lg:ml-0 lg:mr-auto">
                    Sold out!
                  </button>
                ) : userCanMint ? (
                  <div className="flex items-center gap-5">
                    <button
                      className={`
                        ${
                          mintingStep === "idle"
                            ? "bg-brandColor hover:bg-opacity-80"
                            : "bg-gray-500 cursor-not-allowed"
                        } 
                        flex items-center rounded w-fit h-[40px] sm:h-[45px] border border-[rgba(255,255,255,0.1)] px-4 py-5 text-2xl uppercase text-white transition-all font-thin duration-300 ease-in-out mx-auto lg:ml-0 lg:mr-auto
                      `}
                      onClick={handleMint}
                      disabled={
                        mintingStep !== "idle" && mintingStep !== "error"
                      }
                    >
                      {mintingStep === "preparing" && (
                        <div className="flex items-center gap-2">
                          Preparing...
                        </div>
                      )}
                      {mintingStep === "confirming" && (
                        <div className="flex items-center gap-2">
                          Waiting for confirmation...
                        </div>
                      )}
                      {mintingStep === "success" && (
                        <div className="flex items-center gap-2">Success!</div>
                      )}
                      {mintingStep === "idle" && "Mint Monk"}
                    </button>
                  </div>
                ) : (
                  <button className="bg-gray-500 flex items-center rounded w-fit h-[40px] sm:h-[45px] border border-[rgba(255,255,255,0.1)] px-4 py-5 text-2xl uppercase text-white transition-all font-thin duration-300 ease-in-out mx-auto lg:ml-0 lg:mr-auto">
                    MINTED
                  </button>
                )}
                <div className="text-4xl text-white font-medium lg:ml-4">
                  {String(Number(mintPrice.toString()) / 10 ** 18)} MON
                </div>
              </div>
            )}

            <div className="mt-5 p-4 bg-[rgba(255,255,255,0.1)] backdrop-blur-md border border-[rgba(255,255,255,0.1)] rounded-md w-full">
              <div className="flex justify-between items-center mb-3">
                <div
                  className={`pb-1 rounded-full flex items-center text-lg sm:text-3xl font-bold`}
                >
                  <div
                    className={`${
                      isUserWL || isUserFCFS || isUserTeam
                        ? "bg-green-600"
                        : "bg-red-600"
                    } h-3 w-3 mr-3`}
                  />

                  {isDisconnected
                    ? "NOT CONNECTED"
                    : isUserTeam
                    ? "ELIGIBLE TEAM"
                    : isUserWL
                    ? "ELIGIBLE WL"
                    : isUserFCFS
                    ? "ELIGIBLE FCFS"
                    : "NOT ELIGIBLE"}
                </div>
                {address && (
                  <div className="text-center">
                    <span className="text-lg sm:text-3xl text-gray-300 uppercase">
                      mints:
                    </span>
                    <span className="ml-2 text-lg sm:text-3xl text-white font-medium">
                      {userMints}/{maxMintsPerAddress}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <div
                  className="w-full border border-[rgba(255,255,255,0.05)] h-5 rounded overflow-hidden"
                  style={{
                    boxShadow: "0px 0px 13px 5px rgba(255, 255, 255, 0.05)",
                    background: "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <div
                    className="h-full bg-brandColor transition-all duration-500"
                    style={{
                      width: `${(totalMinted / (maxSupply || 1000)) * 100}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-lg text-gray-200 uppercase">
                    Total minted
                  </span>
                  <span className="text-lg font-medium text-white">
                    {totalMinted || 0} / {maxSupply || 3333}
                  </span>
                </div>
                <div className="h-0.5 w-full bg-white/10 my-4" />
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium text-lg sm:text-[22px] uppercase">
                    Current phase:{" "}
                    <span className="text-yellow-500">
                      {mintPhaseInfo?.currentPhase === "First Come First Served"
                        ? "FCFS"
                        : mintPhaseInfo?.currentPhase === "Team Only"
                        ? "TEAM"
                        : mintPhaseInfo?.currentPhase === "Whitelist"
                        ? "WHITELIST"
                        : "Loading..."}
                    </span>
                  </p>
                  {/* <p className="text-white font-bold text-lg sm:text-[22px] uppercase">
                    {!isSoldOut && (
                      <CountdownTimer
                        currentPhase={mintPhaseInfo?.currentPhase}
                      />
                    )}
                  </p> */}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="w-[90%] max-w-[1100px] mt-10 mx-auto mb-10">
          <UserNFTs />
        </div>
      </main>
    </>
  );
}
