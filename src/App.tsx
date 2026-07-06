import { useEffect } from "react";
import { ChatInput } from "./components/ChatInput";
import { FishTank } from "./components/FishTank";
import { FloatingToast } from "./components/FloatingToast";
import { LLMSettingsDialog } from "./components/LLMSettingsDialog";
import { useFishStore } from "./state/fishStore";

const OFFLINE_TOAST = { title: "You are offline", caption: "Functionality will be limited." };

export default function App() {
  const isOffline = useFishStore((s) => s.isOffline);
  const toast = useFishStore((s) => s.toast);
  const closeToast = useFishStore((s) => s.closeToast);
  const setOffline = useFishStore((s) => s.setOffline);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [setOffline]);

  return (
    <div className="page">
      <main>
        <article id="mainView" className="content">
          <div className="fish-tank-container">
            <FishTank />
            <ChatInput />
          </div>
        </article>
      </main>
      <LLMSettingsDialog />
      <FloatingToast
        isVisible={isOffline}
        position="BottomRight"
        showCloseButton={false}
        toast={OFFLINE_TOAST}
      />
      <FloatingToast
        isVisible={toast !== null}
        position="TopRight"
        toast={toast}
        onClose={closeToast}
      />
    </div>
  );
}
