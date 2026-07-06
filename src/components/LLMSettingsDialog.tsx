import { useEffect } from "react";
import { useFishStore } from "../state/fishStore";
import { useLlmStore } from "../state/llmStore";
import { positionClasses } from "./positioning";
import "../styles/llmSettings.css";

export function LLMSettingsDialog() {
  const isVisible = useFishStore((s) => s.isSettingsVisible);
  const closeSettings = useFishStore((s) => s.closeSettings);
  const {
    availableModels,
    downloadedModels,
    selectedModel,
    loadedModel,
    progressText,
    progressValue,
    isProgressVisible,
    initialize,
    selectModel,
    loadEngine,
  } = useLlmStore();

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isVisible) {
    return null;
  }

  const isDownloaded = downloadedModels.includes(selectedModel);
  return (
    <div className={positionClasses("TopLeft")} role="dialog" aria-labelledby="llm-settings-title">
      <div className="floating-component llm-settings">
        <div className="floating-header">
          <strong id="llm-settings-title" className="me-auto">
            Configure Chat LLM Settings
          </strong>
          <button
            type="button"
            className="btn-close floating-close"
            onClick={closeSettings}
            aria-label="Close"
          ></button>
        </div>
        <div className="floating-body">
          <div className="download-container">
            <label htmlFor="model-selection" className="visually-hidden">
              Select LLM Model
            </label>
            <select
              id="model-selection"
              value={selectedModel}
              onChange={(e) => selectModel(e.target.value)}
              aria-label="Select LLM Model"
            >
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                  {downloadedModels.includes(model) ? " (downloaded)" : ""}
                </option>
              ))}
            </select>
            <button
              id="download"
              type="button"
              onClick={() => void loadEngine()}
              aria-label={isDownloaded ? "Load selected model" : "Download selected model"}
            >
              {isDownloaded ? "Load" : "Download"}
            </button>
          </div>
          <p className="model-status" aria-live="polite">
            {loadedModel ? (
              <span>
                Loaded: <strong>{loadedModel}</strong>
              </span>
            ) : (
              <span>No model loaded</span>
            )}
          </p>
          {isProgressVisible && (
            <div>
              <label htmlFor="download-progress" className="visually-hidden">
                Download progress
              </label>
              <progress
                id="download-progress"
                value={progressValue * 100}
                max={100}
                className="w-100 mb-2"
              />
              <p id="download-status" aria-live="polite">
                {progressText}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
