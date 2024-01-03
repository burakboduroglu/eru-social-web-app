import React from "react";

export default function () {
  return (
    <div>
      <h1 className="head-text mb-5">Kampüs Haritası</h1>
      <div style={{ position: "relative", height: 0, paddingBottom: "75%" }}>
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d8805.914887633506!2d35.51991758608631!3d38.709518536892276!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x152b128772a0703f%3A0xac1161778fc5a4f3!2sErciyes%20%C3%9Cniversitesi%20M%C3%BChendislik%20Fak%C3%BCltesi!5e0!3m2!1str!2str!4v1704289007495!5m2!1str!2str"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="rounded-lg border-2 border-gray-300"
        ></iframe>
      </div>
    </div>
  );
}
