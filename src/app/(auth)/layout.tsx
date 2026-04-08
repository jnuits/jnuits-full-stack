export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth-shell flex flex-1 items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-xl px-6 py-8 sm:px-8">{children}</div>
    </main>
  );
}
