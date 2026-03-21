import Image from 'next/image';
import SplashNav from '@/components/SplashNav';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#2a3140] flex flex-col">
      <SplashNav />
      {/* Campaign splash art fills the remaining viewport */}
      <div className="flex-1 relative overflow-hidden">
        <Image
          src="/SOTW_splash.png"
          alt="Shadow of the Wolf"
          fill
          className="object-contain object-top"
          priority
          style={{ transform: 'translateY(-30px)' }}
        />
      </div>
    </div>
  );
}
