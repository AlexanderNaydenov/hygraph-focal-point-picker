import { useApp, Wrapper } from "@hygraph/app-sdk-react";

function SetupContent() {
  const { installation, updateInstallation } = useApp();
  const installed = installation.status === "COMPLETED";

  return (
    <div className="setup">
      <h1>An Asset Focal Point Picker</h1>
      <p>
        This app provides a <strong>Focal point</strong> JSON field element and
        an optional sidebar picker.
      </p>
      <ol>
        <li>Click <strong>Install app</strong> below.</li>
        <li>
          On <strong>Asset</strong>, add <strong>Focal point</strong> from{" "}
          <strong>Add field → Apps</strong> (not generic JSON).
        </li>
        <li>
          Set API ID to <code>focalPoint</code>. Enable localization if needed.
        </li>
        <li>
          In field settings, set the form renderer to <strong>Focal point</strong>{" "}
          (not <strong>Json Editor</strong>).
        </li>
        <li>Save and publish the schema.</li>
        <li>
          Optionally add the <strong>Select focal point</strong> sidebar widget.
        </li>
      </ol>

      <details className="setup-troubleshooting">
        <summary>
          Seeing &quot;App element not found for field Focal point&quot;?
        </summary>
        <p>
          Open the field in the schema builder and change the form renderer from{" "}
          <strong>Json Editor</strong> to <strong>Focal point</strong>. The app
          field icon alone does not select the correct renderer.
        </p>
      </details>
      <button
        type="button"
        onClick={() =>
          updateInstallation({ status: "COMPLETED", config: {} })
        }
      >
        {installed ? "Save configuration" : "Install app"}
      </button>
    </div>
  );
}

function SdkFallback({ state }: { state: string }) {
  return (
    <div className="sdk-fallback">
      {state === "error"
        ? "SDK connection error. Open this page from within Hygraph."
        : "Connecting to Hygraph…"}
    </div>
  );
}

export default function SetupPage() {
  return (
    <Wrapper fallback={SdkFallback}>
      <SetupContent />
    </Wrapper>
  );
}
