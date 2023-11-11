import Footer from "@/components/shared/Footer";
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-custom">
      <SignIn />
      <Footer />
    </div>
  );
}
