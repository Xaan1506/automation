import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Newton Assignment AI",
  description: "AI-powered assignment processing for Newton School",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans bg-newton-dark text-white antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1E1E3F",
              color: "#fff",
              border: "1px solid rgba(108,99,255,0.3)",
            },
          }}
        />
      </body>
    </html>
  );
}
