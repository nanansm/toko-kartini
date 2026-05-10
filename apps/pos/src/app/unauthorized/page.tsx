export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
      <div className="text-center text-white space-y-4">
        <div className="text-5xl">🚫</div>
        <h1 className="text-xl font-bold">Akses Ditolak</h1>
        <p className="text-stone-400 text-sm">
          Akun kamu tidak punya akses ke POS Toko Kartini.
        </p>
        <a
          href="/login"
          className="inline-block mt-4 text-kartini-green hover:underline text-sm"
        >
          Kembali ke Login
        </a>
      </div>
    </main>
  );
}
