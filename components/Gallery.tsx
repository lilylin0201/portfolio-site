import Image from "next/image";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    __nextGalleryComponent?: {
      setActiveGallery: (gallery: string) => void;
    };
  }
}

const Art = [
  {
    slug: "light-of-the-world",
    imageSrc: "/art/light-of-the-world.jpg",
    title: "Light of the World",
    type: "Painting",
  },
  {
    slug: "blue-and-orange",
    imageSrc: "/art/blue-and-orange.jpg",
    title: "Blue and Orange",
    type: "Painting",
  },
  {
    slug: "red1",
    imageSrc: "/art/red-feeling.jpg",
    title: "RED",
    type: "Painting",
  },
  {
    slug: "flowers1",
    imageSrc: "/art/flowers-1-new.jpg",
    title: "When Flowers Die, Will Love Die Too? (1)",
    type: "Painting",
  },
  {
    slug: "flowers2",
    imageSrc: "/art/flowers-2.jpg",
    title: "When Flowers Die, Will Love Die Too? (2)",
    type: "Painting",
  },
  {
    slug: "flowers3",
    imageSrc: "/art/flowers-3.jpg",
    title: "When Flowers Die, Will Love Die Too? (3)",
    type: "Painting",
  },
  {
    slug: "flowers4",
    imageSrc: "/art/flowers-4.jpg",
    title: "When Flowers Die, Will Love Die Too? (4)",
    type: "Painting",
  },
  {
    slug: "stretch",
    imageSrc: "/art/stretch-pastel.JPG",
    title: "Stretch",
    type: "Drawing",
  },
  {
    slug: "home",
    imageSrc: "/art/home.jpg",
    title: "Home",
    type: "Drawing",
  },
  {
    slug: "woman",
    imageSrc: "/art/woman.jpg",
    title: "What It Means to Be a Woman",
    type: "Painting",
  },
  {
    slug: "contemporary-still-life",
    imageSrc: "/art/still-life.jpg",
    title: "Still-Life of Contemporary Objects",
    type: "Painting",
  },
  {
    slug: "food-dipped-in-milk",
    imageSrc: "/art/milk.jpg",
    title: "Food Dipped In Milk",
    type: "Woodcut",
  },
  {
    slug: "the-embrace",
    imageSrc: "/art/embrace-1.png",
    title: "The Embrace",
    type: "Sculpture",
  },
  {
    slug: "boats1",
    imageSrc: "/art/day.jpg",
    title: "Boats (Day)",
    type: "Drawing",
  },
  {
    slug: "boats2",
    imageSrc: "/art/night.jpg",
    title: "Boats (Night)",
    type: "Drawing",
  },
];

const Design = [
  {
    slug: "njordic-supermarket",
    imageSrc: "/design/njordic-mockup.jpg",
    title: "Njordic Supermarket",
    type: "Brand Design",
  },
  {
    slug: "janice",
    imageSrc: "/design/janice-mockup.jpg",
    title: "Janice, Fashion Shopping Chatbot",
    type: "UX Design",
  },
  {
    slug: "wet-and-orange",
    imageSrc: "/design/book_cover.jpg",
    title: "Once Upon a Wet and Orange Day",
    type: "Book Design",
  },
];

function ArtGallery() {
  type ArtItem = {
    slug: string;
    imageSrc: string;
    title: string;
    type: string;
  };

  const [selectedArt, setSelectedArt] = useState<ArtItem | null>(null);

  return (
    <>
      {selectedArt && (
        <div
          className="fixed inset-0 bg-white bg-opacity-95 z-50 flex items-center justify-center p-2 md:p-10"
          onClick={() => setSelectedArt(null)} // clicking closes
        >
          <Image
            src={selectedArt.imageSrc}
            width={800}
            height={800}
            alt={selectedArt.title}
            className="object-contain rounded max-h-[90vh] w-auto"
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-16">
        {Art.map((art) => {
          return (
            <div
              key={art.slug}
              className="flex flex-col h-full cursor-pointer"
              onClick={() => {
                setSelectedArt(art);
              }}
            >
              <div className="flex-grow flex items-center justify-center">
                <Image
                  src={art.imageSrc}
                  alt={art.title}
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="w-full h-auto object-contain rounded-sm"
                />
              </div>

              <div className="mt-2">
                <p className="font-bold uppercase">{art.title}</p>
                <p className="text-sm text-gray-400 uppercase">{art.type}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DesignGallery() {
  return (
    <div className="grid space-y-8 md:px-20">
      {Design.map((design) => {
        return (
          <div key={design.slug} className="flex flex-col space-y-3">
            <div className="relative w-full aspect-video overflow-hidden rounded-sm">
              <a href={`/design/${design.slug}`} rel="noopener noreferrer">
                <Image
                  src={design.imageSrc}
                  alt={design.title}
                  fill
                  className="object-cover rounded-sm"
                />
              </a>
            </div>
            {/* label desktop */}
            <div className="hidden md:flex mt-2">
              <span className="font-bold uppercase">{design.title}</span>{" "}
              <span className="pl-3 text-gray-400 uppercase"> {design.type}</span>
            </div>
            {/* label mobile */}
            <div className="md:hidden mt-2">
              <p className="font-bold uppercase">{design.title}</p>{" "}
              <p className="text-sm text-gray-400 uppercase"> {design.type}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Gallery({ hideSwitcher }: { hideSwitcher: boolean }) {
  const [activeGallery, setActiveGallery] = useState("design");

  useEffect(() => {
    window.__nextGalleryComponent = {
      setActiveGallery,
    };

    return () => {
      delete window.__nextGalleryComponent;
    };
  }, []);


  return (
    <div className="pb-10 pt-16 md:pt-24 ">
      {/* mobile gallery switcher */}
      <div className={`md:hidden w-full flex justify-between px-8 py-6 z-50 `}>
        <button onClick={() => setActiveGallery("art")}>
          <Image
            src="/svgs/art.svg"
            width={50}
            height={0}
            alt=""
            className={`${activeGallery === "design" ? "opacity-30" : "opacity-100"
              }`}
          />
        </button>
        <button onClick={() => setActiveGallery("design")}>
          <Image
            src="/svgs/design.svg"
            width={100}
            height={0}
            alt=""
            className={`${activeGallery === "design" ? "opacity-100" : "opacity-30"
              }`}
          />
        </button>
      </div>

      {/* gallery */}
      <div className="flex items-center justify-center">
        <div className="w-5/6 md:w-2/3">
          {activeGallery === "art" ? <ArtGallery /> : <DesignGallery />}
        </div>
      </div>

      {/* DESKTOP switcher */}
      <div
        className={`invisible md:visible fixed bottom-10 w-full flex justify-between px-20 transition-opacity duration-500 ${hideSwitcher ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
      >
        <button onClick={() => setActiveGallery("art")}>
          <Image
            src="/svgs/art.svg"
            width={50}
            height={0}
            alt=""
            className={`${activeGallery === "design" ? "opacity-30" : "opacity-100"
              }`}
          />
        </button>
        <button onClick={() => setActiveGallery("design")}>
          <Image
            src="/svgs/design.svg"
            width={100}
            height={0}
            alt=""
            className={`${activeGallery === "design" ? "opacity-100" : "opacity-30"
              }`}
          />
        </button>
      </div>
    </div>
  );
}
