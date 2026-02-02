export default function VerifyEmail({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-6xl font-extrabold text-white mb-2">ScoreCast</h1>
      <p className="text-white/80 text-lg mb-12">Premier League & UCL prediction leagues</p>

      <div className="w-full max-w-sm">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 shadow-xl text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2 tracking-tight">Verify your email</h2>
            <p className="text-white/70">
              We've sent a verification link to
            </p>
            <p className="text-white font-medium mt-1">{email}</p>
          </div>

          <p className="text-white/60 text-sm">
            Click the link in the email to verify your account. If you don't see it, check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
}
