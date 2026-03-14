import { SiDiscord } from "react-icons/si";

export function DiscordFlowerButton() {
  return (
    <a 
      href="https://discord.gg/7DW5gUzNdX" 
      target="_blank" 
      rel="noopener noreferrer"
      className="discord-flower-btn"
      data-testid="button-discord-join"
    >
      <div className="discord-wrapper">
        <div className="discord-text">
          <SiDiscord className="h-5 w-5" />
        </div>

        <div className="flower flower1">
          <div className="petal one"></div>
          <div className="petal two"></div>
          <div className="petal three"></div>
          <div className="petal four"></div>
        </div>
        <div className="flower flower2">
          <div className="petal one"></div>
          <div className="petal two"></div>
          <div className="petal three"></div>
          <div className="petal four"></div>
        </div>
        <div className="flower flower3">
          <div className="petal one"></div>
          <div className="petal two"></div>
          <div className="petal three"></div>
          <div className="petal four"></div>
        </div>
        <div className="flower flower4">
          <div className="petal one"></div>
          <div className="petal two"></div>
          <div className="petal three"></div>
          <div className="petal four"></div>
        </div>
        <div className="flower flower5">
          <div className="petal one"></div>
          <div className="petal two"></div>
          <div className="petal three"></div>
          <div className="petal four"></div>
        </div>
        <div className="flower flower6">
          <div className="petal one"></div>
          <div className="petal two"></div>
          <div className="petal three"></div>
          <div className="petal four"></div>
        </div>
      </div>
    </a>
  );
}
