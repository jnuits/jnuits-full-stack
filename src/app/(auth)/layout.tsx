import { SiteBrand } from "@/components/layout/site-brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth-shell flex flex-1 items-center justify-center px-3 py-8 sm:px-4 sm:py-12">
      <div className="w-full max-w-xl min-w-0">
        <div className="mb-6 flex justify-center">
          <SiteBrand subtitle="Secure portal and operator access" />
        </div>
        <div className="glass-card w-full px-4 py-6 sm:px-8 sm:py-8 min-w-0">{children}</div>
      </div>
    </main>
  );
}
