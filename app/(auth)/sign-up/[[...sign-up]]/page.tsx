import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return(
    <div className="flex flex-col justify-center items-center mt-[10px]">
      <SignUp />;
      <div className="fixed bottom-0 w-full h-10 bg-gray-800 text-white flex justify-center items-center font-sans text-[12px]">
        <p>© 2023 Burak Boduroglu </p>
      </div>
    </div>  
  )
}