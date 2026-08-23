export default function DoctorCard({ doctor, onBook }) {
  return (
    <div className="card">
      <p className="cardTitle">{doctor.name}</p>
      <p className="cardMeta" style={{ marginBottom: 14 }}>
        {doctor.specialty}
      </p>
      <button onClick={() => onBook(doctor)} className="btnSecondary">
        View available times
      </button>
    </div>
  );
}
