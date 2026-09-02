import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#b4b4b4]">
          {this.state.message.includes("conversations") || this.state.message.includes("Could not find")
            ? "Chat tables are not on the Convex deployment yet. Run npx convex dev and refresh."
            : this.state.message}
        </div>
      );
    }

    return this.props.children;
  }
}
