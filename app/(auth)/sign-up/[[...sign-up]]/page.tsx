import Footer from "@/components/shared/Footer";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-custom">
      <SignUp />
    </div>
  );
}
