import { FishTank } from "./components/FishTank";

export default function App() {
  return (
    <div className="page">
      <main>
        <article id="mainView" className="content">
          <div className="fish-tank-container">
            <FishTank />
          </div>
        </article>
      </main>
    </div>
  );
}
