export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">
      <div className="max-w-[700px] mx-auto px-6 py-12">
        <h1 style={{ fontFamily: 'EB Garamond, serif', fontSize: '2rem', marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: '#8a7d6e', fontSize: '0.85rem', marginBottom: 24 }}>Last updated: April 9, 2026</p>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>1. Information We Collect</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            The Service collects only information necessary to run the game: player names, character details, and game data entered by participants. If you opt in to SMS notifications, we store your phone number to deliver in-game messages.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>2. How We Use Your Information</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            Your information is used solely to operate the game companion tool — displaying character sheets, delivering in-game notifications, and generating campaign content. We do not sell, rent, or share your personal information with third parties for marketing purposes.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>3. SMS Communications</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            SMS notifications are strictly opt-in. Messages contain in-game content only (tavern rumors, urgent dispatches, game alerts). Message frequency varies based on game activity, typically a few messages per week. Standard message and data rates may apply. You may opt out at any time by unchecking the SMS option on your player page. Your phone number is stored securely and used only for game notifications.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>4. Third-Party Services</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            The Service uses the following third-party providers to operate: Twilio (SMS delivery), ElevenLabs (text-to-speech audio), Anthropic (AI content generation), OpenAI (text search), and Railway (hosting). Your data is shared with these services only as needed to provide their respective functions.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>5. Data Storage</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            Game data is stored in a secure database hosted on Railway. We retain your data for as long as you are an active participant in the game. You may request deletion of your data by contacting the Dungeon Master.
          </p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>6. Children</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            The Service is not directed at children under 13. We do not knowingly collect personal information from children under 13.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>7. Changes</h2>
          <p style={{ lineHeight: 1.7, color: '#d4c8b8' }}>
            This policy may be updated from time to time. We will notify active participants of any material changes.
          </p>
        </section>
      </div>
    </div>
  );
}
