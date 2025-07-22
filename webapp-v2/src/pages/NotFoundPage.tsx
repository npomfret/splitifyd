export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Page not found</p>
        <a
          href="/"
          className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors inline-block"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}