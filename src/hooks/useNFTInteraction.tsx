"use client";

import { NFT_ABI, NFT_ADDRESS } from "@/contract";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { readContract, waitForTransactionReceipt } from "viem/actions";
import { formatUnits, parseUnits } from "viem/utils";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

// Type definitions
interface NFTMetadata {
  tokenId: bigint;
  metadataId: bigint;
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

// Structure for NFT details
interface UserNFTDetailed {
  tokenId: bigint;
  metadataId: bigint;
  tokenURI: string;
  metadata?: NFTMetadata; // Parsed metadata, optional until retrieved
  normalizedImage?: string; // Normalized image URL for direct display
}

export function useNFT() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const { connect, connectors } = useConnect();
  const publicClient = usePublicClient();
  const [lastMintedTokenId, setLastMintedTokenId] = useState<bigint | null>(
    null
  );
  const isFirstMount = useRef(true);
  const [mintPrice, setMintPrice] = useState<bigint>(BigInt(0));
  // State for user NFTs and their metadata
  const [userNFTs, setUserNFTs] = useState<UserNFTDetailed[]>([]);
  const [nftMetadata, setNftMetadata] = useState<NFTMetadata[]>([]);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  // Ajout d'une référence pour l'intervalle de rafraîchissement
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Read contract data hooks
  const { data: maxSupply } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "MAX_SUPPLY",
  });

  const { data: totalMinted } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "totalMinted",
  });

  const { data: price } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "PRICE",
  });

  const { data: remainingSupply } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "remainingSupply",
  });

  const { data: isPaused } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "paused",
  });

  const { data: userMintStatus } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "getUserMintStatus",
    args: address ? [address] : undefined,
  });

  const { data: mintPhaseInfo } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "getMintPhaseInfo",
  });

  const { data: isUserWL } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "isWhitelisted",
    args: address ? [address] : undefined,
  });

  const { data: isUserOG } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "isOG",
    args: address ? [address] : undefined,
  });

  const { data: isUserFCFS } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "isFCFS",
    args: address ? [address] : undefined,
  });

  const { data: isUserTeam } = useReadContract({
    address: NFT_ADDRESS,
    abi: NFT_ABI,
    functionName: "isTeamMember",
    args: address ? [address] : undefined,
  });

  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isMintLoading, isSuccess: isMintSuccess } =
    useWaitForTransactionReceipt({ hash });

  const createDefaultMetadata = (nft: UserNFTDetailed): NFTMetadata => {
    return {
      tokenId: nft.tokenId,
      metadataId: nft.metadataId,
      name: `LIL MONK #${nft.tokenId.toString()}`,
      description: "Metadata unavailable",
      image: "/preview.gif",
      attributes: [],
    };
  };

  // Function to fetch metadata for NFTs
  const fetchMetadataForNFTs = async (
    nfts: UserNFTDetailed[]
  ): Promise<NFTMetadata[]> => {
    if (!nfts || nfts.length === 0) {
      return [];
    }

    const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

    // Improved fetch function with retry
    const fetchWithRetry = async (url: string, retries = 2) => {
      let lastError;

      for (let i = 0; i <= retries; i++) {
        try {
          const response = await fetch(url, { cache: "no-store" });

          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }

          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            return await response.json();
          }

          // If we don't get JSON content-type, try to parse it anyway
          const text = await response.text();
          try {
            return JSON.parse(text);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_error) {
            throw new Error("Response is not valid JSON");
          }
        } catch (error) {
          lastError = error;

          // Don't wait on the last retry
          if (i < retries) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s between retries
          }
        }
      }

      throw lastError || new Error("Failed to fetch after retries");
    };

    // Process each NFT in parallel
    const metadataPromises = nfts.map(async (nft) => {
      try {
        if (!nft.tokenURI) {
          return createDefaultMetadata(nft);
        }

        // Build the correct metadata URL
        let metadataUrl = nft.tokenURI;

        // Handle IPFS URLs
        if (metadataUrl.startsWith("ipfs://")) {
          metadataUrl = metadataUrl.replace("ipfs://", IPFS_GATEWAY);
        }

        // Fetch the metadata
        const data = await fetchWithRetry(metadataUrl);

        if (!data || typeof data !== "object") {
          throw new Error("Invalid metadata format");
        }
        console.log("dataaaaaaa", data);
        // Extract and normalize image URL
        const imageUrl = data.image || "/preview.gif";

        // Normalize image URL if it's IPFS
        let normalizedImageUrl = imageUrl;
        if (imageUrl.startsWith("ipfs://")) {
          normalizedImageUrl = imageUrl.replace("ipfs://", IPFS_GATEWAY);
        }

        // Create the metadata object
        const metadata: NFTMetadata = {
          tokenId: nft.tokenId,
          metadataId: nft.metadataId,
          name: data.name || `NFT #${nft.tokenId.toString()}`,
          description: data.description || "",
          image: imageUrl,
          attributes: data.attributes || [],
        };

        // Update the userNFTs state immediately with the normalized image
        setUserNFTs((currentNFTs) =>
          currentNFTs.map((currentNft) => {
            if (currentNft.tokenId === nft.tokenId) {
              return {
                ...currentNft,
                metadata: metadata,
                normalizedImage: normalizedImageUrl,
              };
            }
            return currentNft;
          })
        );

        return metadata;
      } catch (error) {
        console.error(
          `Error fetching metadata for NFT #${nft.tokenId.toString()}:`,
          error
        );
        return createDefaultMetadata(nft);
      }
    });
    console.log("user", userNFTs);
    // Use Promise.allSettled to handle errors gracefully
    const results = await Promise.allSettled(metadataPromises);
    console.log("results", results);
    // Extract successful results
    const metadata = results
      .filter(
        (result): result is PromiseFulfilledResult<NFTMetadata> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value);

    return metadata;
  };

  // Function to refresh user NFTs
  const refreshUserNFTs = async () => {
    if (!address || !publicClient) {
      return null;
    }

    if (isLoadingNFTs) {
      return null;
    }

    setIsLoadingNFTs(true);

    try {
      (await readContract(publicClient, {
        address: NFT_ADDRESS,
        abi: NFT_ABI,
        functionName: "totalMinted",
      })) as bigint;

      const result = await readContract(publicClient, {
        address: NFT_ADDRESS,
        abi: NFT_ABI,
        functionName: "getUserNFTsDetailed",
        args: [address],
      });

      if (!result || !Array.isArray(result) || result.length < 4) {
        setUserNFTs([]);
        setNftMetadata([]);
        setIsLoadingNFTs(false);
        return [];
      }

      // Extract and safely type the data
      const [userTokensArray, metadataArray, tokenURIsArray] = result;

      const userTokens = userTokensArray as readonly bigint[];
      const metadataIds = metadataArray as readonly bigint[];
      const tokenURIs = tokenURIsArray as readonly string[];

      if (!userTokens.length) {
        setUserNFTs([]);
        setNftMetadata([]);
        setIsLoadingNFTs(false);
        return [];
      }

      // Create NFT details
      const nftDetails: UserNFTDetailed[] = Array.from(
        { length: userTokens.length },
        (_, i) => {
          const tokenId = userTokens[i];
          // Find existing NFT to preserve its metadata
          const existingNFT = userNFTs.find((nft) => nft.tokenId === tokenId);

          return {
            tokenId,
            metadataId: metadataIds[i],
            tokenURI: tokenURIs[i] || "",
            metadata: existingNFT?.metadata,
            normalizedImage: existingNFT?.normalizedImage || "/preview.gif",
          };
        }
      );

      // Update state with NFTs
      setUserNFTs(nftDetails);

      // Fetch metadata for NFTs that don't have it yet
      const nftsNeedingMetadata = nftDetails.filter((nft) => !nft.metadata);

      if (nftsNeedingMetadata.length > 0) {
        console.log(`Fetching metadata for ${nftsNeedingMetadata.length} NFTs`);

        // Start fetching metadata immediately
        fetchMetadataForNFTs(nftsNeedingMetadata).then((newMetadata) => {
          // Update nftMetadata state
          setNftMetadata((currentMetadata) => [
            ...currentMetadata.filter(
              (m) => !newMetadata.some((nm) => nm.tokenId === m.tokenId)
            ),
            ...newMetadata,
          ]);
        });
      }

      setIsLoadingNFTs(false);
      return nftDetails;
    } catch (error) {
      console.error("Error while refreshing NFTs:", error);
      setIsLoadingNFTs(false);
      return null;
    }
  };

  // Function to format MON/ETH amounts
  const formatMON = (weiAmount: bigint | undefined): string => {
    if (!weiAmount) return "0";
    return formatUnits(weiAmount, 18);
  };

  const parseMON = (monAmount: string): bigint => {
    try {
      return parseUnits(monAmount, 18);
    } catch (error) {
      console.error("Error parsing MON amount:", error);
      return BigInt(0);
    }
  };

  useEffect(() => {
    getMintPrice();
  }, [mintPhaseInfo]);

  const getMintPrice = (): bigint => {
    const currentPhase = formatMintPhaseInfo()?.currentPhase;

    if (
      typeof isUserTeam !== "undefined" &&
      isUserTeam !== null &&
      Boolean(isUserTeam)
    ) {
      return BigInt(0);
    }

    switch (currentPhase) {
      case "Team Only": {
        setMintPrice(BigInt(0));
        return BigInt(0);
      }
      case "Whitelist": {
        setMintPrice(BigInt(1 * 10 ** 18));
        return BigInt(1 * 10 ** 18);
      }
      case "First Come First Served": {
        setMintPrice(BigInt(3 * 10 ** 18));
        return BigInt(3 * 10 ** 18);
      }
      case "Public Mint": {
        setMintPrice(BigInt(50 * 10 ** 18));
        return BigInt(50 * 10 ** 18);
      }
      default:
        return BigInt(0);
    }
  };

  const getFormattedPrice = (): string => {
    const mintPrice = getMintPrice();
    return formatMON(mintPrice);
  };

  // Mint function
  const mint = async (isOG: boolean = false) => {
    if (!isConnected) {
      await connect({ connector: connectors[0] });
      return null;
    }

    if (!publicClient) {
      throw new Error("Client unavailable");
    }

    const mintPrice = getMintPrice();

    try {
      const txHash = await writeContract({
        address: NFT_ADDRESS,
        abi: NFT_ABI,
        functionName: "mint",
        args: [isOG],
        value: mintPrice,
        account: address,
        gas: BigInt(300000),
      });

      if (typeof txHash === "string") {
        await waitForTransactionReceipt(publicClient, {
          hash: txHash as `0x${string}`,
          confirmations: 1,
        });

        invalidateQueries();

        try {
          const currentTotalMinted = (await readContract(publicClient, {
            address: NFT_ADDRESS,
            abi: NFT_ABI,
            functionName: "totalMinted",
          })) as bigint;

          const newTokenId = currentTotalMinted - BigInt(1);
          setLastMintedTokenId(newTokenId);
        } catch (err) {
          console.error("Error retrieving totalMinted:", err);
        }

        return { success: true, hash: txHash };
      } else {
        throw new Error("Invalid transaction hash");
      }
    } catch (error) {
      console.error("Error during mint:", error);
      throw new Error("Transaction failed. Check parameters and try again.");
    }
  };

  // Invalidate cache queries
  const invalidateQueries = () => {
    if (!queryClient) return;

    const queries = [
      "totalMinted",
      "MAX_SUPPLY",
      "getUserMintStatus",
      "remainingSupply",
      "getMintPhaseInfo",
      "getUserNFTsDetailed",
    ].map((functionName) => ({
      queryKey: [
        "readContract",
        {
          address: NFT_ADDRESS,
          functionName,
        },
      ],
    }));

    queries.forEach((query) => queryClient.invalidateQueries(query));
  };

  useEffect(() => {
    if (address && publicClient) {
      if (isFirstMount.current) {
        refreshUserNFTs();
        isFirstMount.current = false;
      }

      refreshIntervalRef.current = setInterval(() => {
        console.log("Rafraîchissement automatique des données");
        refreshUserNFTs();
        invalidateQueries();
      }, 10000); // 10 secondes

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (isMintSuccess) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      invalidateQueries();

      const refreshSequence = [
        {
          delay: 1000,
          message: "Premier rafraîchissement immédiat après le mint",
        },
        {
          delay: 3000,
          message: "Deuxième rafraîchissement pour vérifier les métadonnées",
        },
        {
          delay: 8000,
          message: "Troisième rafraîchissement pour confirmer tous les NFTs",
        },
        {
          delay: 15000,
          message: "Rafraîchissement final pour validation complète",
        },
      ];

      let totalDelay = 0;

      refreshSequence.forEach((step, index) => {
        totalDelay += step.delay;

        setTimeout(async () => {
          try {
            console.log(
              `${step.message} - Séquence ${index + 1}/${
                refreshSequence.length
              }`
            );
            await refreshUserNFTs();

            if (
              index === refreshSequence.length - 1 &&
              address &&
              publicClient
            ) {
              refreshIntervalRef.current = setInterval(() => {
                console.log("Rafraîchissement automatique des données");
                refreshUserNFTs();
                invalidateQueries();
              }, 10000);
            }
          } catch (error) {
            console.error(
              `Erreur pendant le rafraîchissement #${index + 1}:`,
              error
            );
          }
        }, totalDelay);
      });
    }
  }, [isMintSuccess, address, publicClient]);

  const formatUserMintStatus = () => {
    if (
      !userMintStatus ||
      !Array.isArray(userMintStatus) ||
      userMintStatus.length < 5
    ) {
      return null;
    }

    return {
      canCurrentlyMint: Boolean(userMintStatus[0]),
      mintsDone: Number(userMintStatus[1]),
      mintsAllowed: Number(userMintStatus[2]),
      mintsRemaining: Number(userMintStatus[3]),
      userStatus: String(userMintStatus[4]),
    };
  };

  const formatMintPhaseInfo = () => {
    if (
      !mintPhaseInfo ||
      !Array.isArray(mintPhaseInfo) ||
      mintPhaseInfo.length < 5
    ) {
      return null;
    }

    return {
      currentPhase: String(mintPhaseInfo[0]),
      isActive: Boolean(mintPhaseInfo[1]),
      totalSupply: Number(mintPhaseInfo[2]),
      mintedCount: Number(mintPhaseInfo[3]),
      remainingCount: Number(mintPhaseInfo[4]),
    };
  };

  return {
    // Contract Metadata
    maxSupply: Number(maxSupply ?? 0),
    totalMinted: Number(totalMinted ?? 0),
    price,
    remainingSupply: Number(remainingSupply ?? 0),
    isPaused: Boolean(isPaused),

    // Mint Functionality
    mint,
    isLoading: isMintLoading,
    isSuccess: isMintSuccess,
    error,
    refreshUserNFTs,
    lastMintedTokenId,
    isLoadingNFTs,

    // Dynamic price by phase
    getMintPrice,
    getFormattedPrice,
    formatMON,
    parseMON,

    // User Status
    isConnected,
    userMintStatus: formatUserMintStatus(),
    isUserWL: Boolean(isUserWL),
    isUserOG: Boolean(isUserOG),
    isUserFCFS: Boolean(isUserFCFS),
    isUserTeam: Boolean(isUserTeam),

    // Mint Phase Info
    mintPhaseInfo: formatMintPhaseInfo(),

    // User NFTs
    mintPrice,
    nftMetadata,
    userNFTs,
  };
}
