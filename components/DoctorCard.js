export default function DoctorCard({ doctor, onBook }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <h3 style={{ margin: "0 0 4px" }}>{doctor.name}</h3>
      <p style={{ margin: "0 0 8px", color: "#666" }}>{doctor.specialty}</p>
      <button onClick={() => onBook(doctor)}>View available times</button>
    </div>
  );
}
