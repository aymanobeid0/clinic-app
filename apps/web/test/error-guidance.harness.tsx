import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { PatientForm } from "../src/features/patients/PatientForm.js";
import { SignInForm } from "../src/features/identity/components/SignInForm.js";
import { post } from "../src/features/identity/identity.api.js";
function Consumer() {
  const [error, setError] = useState("");
  return (
    <main>
      {error && <p role="alert">{error}</p>}
      {location.search.includes("login") ? (
        <SignInForm
          busy={false}
          unavailable={false}
          onInvalid={setError}
          onSubmit={async (input) => {
            try {
              await post("sign-in", input);
            } catch (error) {
              setError(error instanceof Error ? error.message : "Erreur");
            }
          }}
        />
      ) : (
        <PatientForm
          onError={setError}
          onSave={async (details, commandId) => {
            await post("patients", { ...details, commandId });
          }}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Consumer />
  </StrictMode>,
);
