export default function Background({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative w-full min-h-screen overflow-hidden" style={{
      background: 'linear-gradient(to right, rgba(26, 8, 38, 1) 0%, #1a0826 35%, #120830 45%, #08083d 55%, #00044a 65%, #00044a 100%)'
    }}>
      {children}
    </div>
  );
}
