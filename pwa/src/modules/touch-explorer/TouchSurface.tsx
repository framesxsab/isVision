/**
 * TouchSurface — A full-screen area containing sample content
 * that users can explore by touch. Each element is properly
 * labeled for the describer to announce.
 */

export function TouchSurface() {
  return (
    <div className="p-6 space-y-6 select-none">
      {/* Heading */}
      <h2 className="text-2xl font-bold text-white">
        Welcome to Touch Explorer
      </h2>
      <p className="text-gray-300 text-lg leading-relaxed">
        Slide your finger across this page. Every element you touch will be
        spoken aloud with haptic feedback. Try touching the buttons, links,
        images, and headings below.
      </p>

      {/* Buttons */}
      <section aria-label="Sample buttons">
        <h3 className="text-xl font-semibold text-white mb-3">Buttons</h3>
        <div className="flex flex-wrap gap-3">
          <button className="bg-primary-600 text-white px-5 py-3 rounded-xl font-semibold min-h-touch">
            Submit form
          </button>
          <button className="bg-green-600 text-white px-5 py-3 rounded-xl font-semibold min-h-touch">
            Save changes
          </button>
          <button
            className="bg-gray-600 text-gray-400 px-5 py-3 rounded-xl font-semibold min-h-touch"
            disabled
          >
            Disabled button
          </button>
        </div>
      </section>

      {/* Links */}
      <section aria-label="Sample links">
        <h3 className="text-xl font-semibold text-white mb-3">Links</h3>
        <ul className="space-y-2">
          <li>
            <a href="#" className="text-primary-400 underline text-lg" onClick={(e) => e.preventDefault()}>
              Learn about accessibility
            </a>
          </li>
          <li>
            <a href="#" className="text-primary-400 underline text-lg" onClick={(e) => e.preventDefault()}>
              Download screen reader
            </a>
          </li>
          <li>
            <a href="#" className="text-primary-400 underline text-lg" onClick={(e) => e.preventDefault()}>
              Join the community
            </a>
          </li>
        </ul>
      </section>

      {/* Images */}
      <section aria-label="Sample images">
        <h3 className="text-xl font-semibold text-white mb-3">Images</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-center h-32">
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' fill='%23818cf8'%3E%3Crect width='80' height='80' rx='8'/%3E%3Ctext x='40' y='45' text-anchor='middle' fill='white' font-size='12'%3ESunset%3C/text%3E%3C/svg%3E"
              alt="A beautiful sunset over the ocean with orange and purple sky"
              className="rounded"
            />
          </div>
          <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-center h-32">
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' fill='%2334d399'%3E%3Crect width='80' height='80' rx='8'/%3E%3Ctext x='40' y='45' text-anchor='middle' fill='white' font-size='12'%3EForest%3C/text%3E%3C/svg%3E"
              alt="A dense green forest with tall pine trees and morning fog"
              className="rounded"
            />
          </div>
        </div>
      </section>

      {/* Form */}
      <section aria-label="Sample form">
        <h3 className="text-xl font-semibold text-white mb-3">Form Fields</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="sample-name" className="block text-gray-300 mb-1">
              Your name
            </label>
            <input
              id="sample-name"
              type="text"
              placeholder="Enter your name"
              aria-describedby="sample-name-hint"
              className="w-full bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 min-h-touch"
            />
            <span id="sample-name-hint" className="sr-only">Enter your full name</span>
          </div>
          <div>
            <label htmlFor="sample-email" className="block text-gray-300 mb-1">
              Email address
            </label>
            <input
              id="sample-email"
              type="email"
              placeholder="you@example.com"
              required
              aria-describedby="sample-email-hint"
              aria-required="true"
              className="w-full bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 min-h-touch"
            />
            <span id="sample-email-hint" className="sr-only">Required. Enter a valid email address</span>
          </div>
          <label className="flex items-center gap-3 min-h-touch">
            <input type="checkbox" className="w-6 h-6" />
            <span className="text-gray-300">I agree to the terms</span>
          </label>
        </div>
      </section>

      {/* Navigation landmark */}
      <nav aria-label="Sample navigation">
        <h3 className="text-xl font-semibold text-white mb-3">Navigation</h3>
        <div className="flex gap-3">
          <a href="#" className="text-primary-400 underline" onClick={(e) => e.preventDefault()}>Home</a>
          <a href="#" className="text-primary-400 underline" onClick={(e) => e.preventDefault()}>About</a>
          <a href="#" className="text-primary-400 underline" onClick={(e) => e.preventDefault()}>Contact</a>
        </div>
      </nav>
    </div>
  );
}
