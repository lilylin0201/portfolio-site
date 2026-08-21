import Image from "next/image";

export default function Blurb() {
  const handleArtClick = () => {
    // Get gallery element
    if (window.__nextGalleryComponent?.setActiveGallery) {
      window.__nextGalleryComponent.setActiveGallery("art");
    }

    const galleryElement = document.querySelector("#gallery-section");
    if (galleryElement) {
      galleryElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDesignClick = () => {
    // Get gallery element
    const galleryElement = document.querySelector("#gallery-section");

    // Set active gallery to design before scrolling
    if (window.__nextGalleryComponent?.setActiveGallery) {
      window.__nextGalleryComponent.setActiveGallery("design");
    }

    // Scroll to gallery
    if (galleryElement) {
      galleryElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div id="blurb-section" className="flex flex-col justify-between h-screen pt-30 mx-8 sm:mx-10 md:mx-20">
      <div className="flex-grow flex flex-col items-center justify-center pt-20">
        <Image
          src={"/art/Homepage.gif"}
          width={400}
          height={300}
          alt="Homepage"
          className="hidden md:flex"
        />
        <Image
          src={"/art/Homepage.gif"}
          width={300}
          height={300}
          alt="Homepage"
          className="md:hidden"
        />
      </div>

      <div className="-tracking-tighter pb-4 md:pb-10">
        <p className="text-xl sm:text-3xl ">
          <strong>
            VISUAL DESIGNER AND ARTIST BASED IN NEW HAVEN AND BEIJING.
          </strong>{" "}
          I
          <span onClick={handleDesignClick} className="cursor-pointer">
            <Image
              src="/svgs/design.svg"
              width={90}
              height={0}
              alt=""
              className="inline-block align-middle mx-2 md:mx-3 -pt-[3px] md:w-24 sm:w-20 animate-bounce"
            />
          </span>
          to solve other people&apos;s problems and make
          <span onClick={handleArtClick} className="cursor-pointer">
            <Image
              src="/svgs/art.svg"
              width={50}
              height={0}
              alt=""
              className="inline-block align-middle mx-2 md:mx-3 -pt-[3px] md:w-14 sm:w-10 animate-bounce"
            />
          </span>
          to solve my own problems.
        </p>
      </div>
    </div>
  );
}
