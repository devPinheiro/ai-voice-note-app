import { type FC, type ReactNode } from "react";

type MainProps = {
  children: ReactNode;
};

const Main: FC<MainProps> = ({ children }) => {
  return (
    <div className="flex flex-col w-full bg-[#212020] space-y-4 text-white h-full">
      {children}
    </div>
  );
};

export default Main;
