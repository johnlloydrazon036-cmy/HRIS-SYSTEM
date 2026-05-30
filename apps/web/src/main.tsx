import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { LeaveProvider } from "./context/LeaveContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LeaveProvider>
          <App />
          <Toaster
            position="top-right"
            richColors
            expand={false}
            closeButton
            toastOptions={{ duration: 3000 }}
          />
        </LeaveProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);