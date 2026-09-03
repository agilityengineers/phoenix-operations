export default function ScorePill({ score }: { score: number }) {
  const tone = score >= 75 ? "green" : score >= 55 ? "amber" : "red";
  return <span className={`score-pill ${tone}`}>{score}</span>;
}
