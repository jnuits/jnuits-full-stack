import { SiteBrand } from "@/components/layout/site-brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth-shell flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <SiteBrand subtitle="Member access and identity flows" />
        </div>
        <div className="glass-card w-full px-6 py-8 sm:px-8">{children}</div>
      </div>
    </main>
  );
}
