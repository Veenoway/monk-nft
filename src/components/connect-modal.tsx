"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/lib/shadcn/modal";
import { FC, PropsWithChildren } from "react";
import { useConnect } from "wagmi";

export const WalletModal: FC<
  PropsWithChildren & { open: boolean; setOpen: (value: boolean) => void }
> = ({ children, open, setOpen }) => {
  const { connect, connectors } = useConnect();
  return (
    <Dialog open={open}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        close={() => setOpen(false)}
        className="sm:max-w-[650px] text-white px-10 py-8 rounded-xl bg-brandColor border border-[rgba(255,255,255,0.1)]"
      >
        <DialogHeader>
          <DialogTitle className="text-4xl mb-3 text-white uppercase">
            Connect Wallet
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-5 w-full">
          {connectors?.map((connector, i) => (
            <button
              key={i}
              style={{
                width: "calc(50% - 10px)",
              }}
              onClick={() => {
                connect({ connector });
                setOpen(false);
              }}
              className=" bg-[#9DA1E4] hover:bg-[#9DA1E4]/70 flex items-center justify-center uppercase border border-[rgba(255,255,255,0.1)] rounded h-[66px] px-2 font-medium text-xl"
            >
              <img
                src={connector.icon}
                alt={connector.name}
                className="w-6 h-6 mr-3"
              />
              {connector.name}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
