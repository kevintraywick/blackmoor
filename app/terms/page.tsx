export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">
      <div className="max-w-[700px] mx-auto px-6 py-12">
        <h1 style={{ fontFamily: 'EB Garamond, serif', fontSize: '2rem', marginBottom: 8 }}>Terms of Use</h1>
        <p style={{ color: '#8a7d6e', fontSize: '0.85rem', marginBottom: 24 }}>Last updated: April 9, 2026</p>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>1. Acceptance</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            By accessing Shadow of the Wolf ("the Service"), you agree to these terms. The Service is a tabletop RPG companion tool operated for personal, non-commercial use by a private game group.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>2. Use of the Service</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            The Service is provided as-is for use by invited players and the Dungeon Master. You may not use the Service for any unlawful purpose or in any way that could damage or impair the Service.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>3. SMS Notifications</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            The Service may send SMS text messages to players who have opted in. Message frequency varies based on game activity. Standard message and data rates may apply. You may opt out at any time by unchecking the SMS option on your player page.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>4. Content</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            All campaign content (characters, stories, maps, items) is created by the Dungeon Master and players. The Service uses AI to generate suggested content, which is always reviewed and approved by the Dungeon Master before publication.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>5. Disclaimer</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            The Service is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>6. Changes</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            These terms may be updated from time to time. Continued use of the Service constitutes acceptance of any changes.
          </p>
        </section>
      </div>
    </div>
  );
}
