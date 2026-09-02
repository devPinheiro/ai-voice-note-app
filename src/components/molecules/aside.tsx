import { type FC, type ReactNode } from "react";

type AsideProps = {
  children: ReactNode;
};

const Aside: FC<AsideProps> = ({ children }) => {
  return (
    <div className="flex flex-col w-3xs border-r border-[#2d2d2d] bg-[#121111] space-y-4 text-white h-full">
      {children}
    </div>
  );
};

export default Aside;
