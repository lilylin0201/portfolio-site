import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <div className="fixed top-0 flex justify-between items-center w-full px-8 md:px-20 py-4 md:py-10 bg-white z-50">
      <a href={"/"}>
        <Image src="/svgs/lilylin.svg" width={100} height={30} alt="" />
      </a>
      <div className="flex space-x-10 uppercase">
        <Link href={"https://medium.com/@lilylinthoughts"} target="_blank">
          Blog
        </Link>
        {/* <Link
          href={
            "https://docs.google.com/document/d/11T7-AnpF1AxztrH9SLzjaVVp4UHLPhWz/edit?usp=sharing&ouid=108107892836613563663&rtpof=true&sd=true"
          }
          target="_blank"
        >
          CV
        </Link> */}
      </div>
    </div>
  );
}
