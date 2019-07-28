import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import fetch from "isomorphic-unfetch";
import reactLeaflet from "react-leaflet";

// import Side from "../components/Side";
const Side = dynamic(() => import("../components/Side"), {
  ssr: false
});

// TODO make it look better
// @ts-ignore
const Map = dynamic(() => import("react-leaflet/lib/Map"), {
  ssr: false
});

// @ts-ignore
const TileLayer = dynamic(() => import("react-leaflet/lib/TileLayer"), {
  ssr: false
});

// @ts-ignore
const Marker = dynamic(() => import("react-leaflet/lib/Marker"), {
  ssr: false
});

// @ts-ignore
const Popup = dynamic(() => import("react-leaflet/lib/Popup"), {
  ssr: false
});

// @ts-ignore
const ZoomControl = dynamic(() => import("react-leaflet/lib/ZoomControl"), {
  ssr: false
});

interface Prop {
  gamecenters: any[] // TODO
}

function IndexPage(props: Prop) {
  const [viewport, setViewport] = useState({ center: [35.6028, 139.6196], zoom: 15 } as reactLeaflet.Viewport);
  const [gameCenterId, setGameCenterId] = useState("");
  const [gameCenterData, setGameCenterData] = useState(null);

  function handleViewportChange(viewport: reactLeaflet.Viewport) {
    // @ts-ignore
    if (viewport!.zoom >= 19) {
      viewport.zoom = 19;
    }

    console.log(viewport.center, viewport.zoom);
    setViewport(viewport)
  }

  const gamecenters = getVisibleGamecenters(props.gamecenters, viewport);

  useEffect(() => {
    async function myFunc() {
      if (gameCenterId) {
        const res = await fetch(`http://localhost:4000/gamecenter/${gameCenterId}`);
        const data = await res.json();
        setGameCenterData(data);
      }
    }

    myFunc();
  }, [gameCenterId]);

  console.log("rendered marks:", gamecenters.length);
  return (
    <div>
      <Head>
        <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/leaflet/1.5.1/leaflet.css" />
      </Head>
      <style jsx global>{`
          h1, h2, h3 {
            margin: 0;
          }

          ul {
            padding-left: 20px;
          }

          body {
            padding: 0;
            margin: 0;
          }
          .leaflet-container {
            position: absolute;
            width: 100%;
            height: 100%;
          }
        `}
      </style>
      {/*
        // @ts-ignore*/}
      <Map viewport={viewport} onViewportChange={handleViewportChange} zoomControl={false}>
        {/*
        // @ts-ignore*/}
        <TileLayer
          attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/*
        // @ts-ignore*/}
        <ZoomControl position="bottomright" />
        {
          // props.gamecenters.map((gamecenter) => <GameCenterMarker key={gamecenter.id} {...gamecenter} />)
          gamecenters.map(({ id, geo, infos }) => {
            // @ts-ignore
            return <Marker key={id} position={[geo.lat, geo.lng]} onClick={() => setGameCenterId(id)} >
              <Popup>{infos[0].text}</Popup>
            </Marker>
          })
        }
      </Map>
      <Side gameCenterId={gameCenterId} gameCenterData={gameCenterData} />
    </div >
  );
}

function getVisibleGamecenters(gamecenters: any[], viewport: reactLeaflet.Viewport): any[] {
  // @ts-ignore
  if (viewport.zoom < 10) return [];
  // return gamecenters;
  // @ts-ignore
  const [lat, lng] = viewport.center;
  // @ts-ignore
  const rangeRadio = 2 ** viewport.zoom;
  let latRange = 2 ** 10 / rangeRadio;
  let lngRnage = 2 ** 10 / rangeRadio;

  console.log({ latRange, lngRnage });

  let filtered = gamecenters;

  while (filtered.length > 300) {
    filtered = gamecenters.filter(({ geo }) => {
      // @ts-ignore*/
      return Math.abs(geo.lat - lat) < (latRange) && Math.abs(geo.lng - lng) < (lngRnage);
    });

    latRange /= 2;
    lngRnage /= 2;
  }

  return filtered;
}

IndexPage.getInitialProps = async function () {
  const res = await fetch("http://localhost:4000/gamecenters");
  const data = await res.json();

  console.log(`Show data fetched. Count: ${data.length}`);

  return {
    gamecenters: data
  };
}

export default IndexPage;
