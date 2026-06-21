"use client";

import { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Corrige o ícone padrão do leaflet no webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function DeliveryMap({ center, radiusKm }) {
  const position = center || [-23.550520, -46.633308]; // São Paulo default
  const radiusMeters = (radiusKm || 5) * 1000;

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
      <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
        <ChangeView center={position} zoom={13} />
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} />
        <Circle
          center={position}
          radius={radiusMeters}
          pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 2 }}
        />
      </MapContainer>
    </div>
  );
}
