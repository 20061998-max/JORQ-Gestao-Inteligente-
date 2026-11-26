export function SiteBackground() {
  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-20 bg-[#060D1C] bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('/assets/aistudio/image_2b59ebc8_faaaa2a5.jpg')" }}
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-gradient-to-b from-[#060D1C]/40 via-[#060D1C]/30 to-[#060D1C]/55 pointer-events-none"
      />
    </>
  );
}
