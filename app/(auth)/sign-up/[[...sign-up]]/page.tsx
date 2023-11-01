import Footer from "@/components/shared/Footer";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex flex-col justify-center items-center mt-[10px]">
      <SignUp />;
      <Footer />
    </div>
  );
}
