export function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Splitifyd v2
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Built with Preact + Vite + TypeScript
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Login
          </a>
          <a
            href="/register"
            className="px-6 py-3 border border-primary text-primary rounded-lg hover:bg-primary-50 transition-colors"
          >
            Sign Up
          </a>
        </div>
      </div>
    </div>
  );
}