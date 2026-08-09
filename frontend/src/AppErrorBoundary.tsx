import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Brand } from "./components";


type Props = { children: ReactNode };
type State = { failed: boolean };


export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _details: ErrorInfo) {
    // Error details are deliberately not rendered or persisted client-side.
    // Production monitoring can be connected here without exposing learner data.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f7fa] px-5 py-12">
        <section className="w-full max-w-xl rounded-2xl bg-white p-7 shadow-soft sm:p-10">
          <Brand />
          <span className="mt-8 grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <AlertTriangle size={24} />
          </span>
          <h1 className="mt-5 text-2xl font-black text-navy-950">
            This section could not be displayed
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your saved work has not been removed. Reload NeuroLearn-X to try again.
            If the problem continues, contact an authorized teacher.
          </p>
          <button
            type="button"
            className="btn-primary mt-6"
            onClick={() => window.location.reload()}
          >
            Reload application <RefreshCw size={17} />
          </button>
        </section>
      </main>
    );
  }
}
