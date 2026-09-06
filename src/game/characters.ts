import { ROSTER } from './content';
const bios=[
'Aldric mengingat semua cara melindungi orang lain, tetapi tidak ingat siapa yang pertama ia lindungi. Perisainya memiliki goresan yang tidak sesuai dengan usianya. Ia belajar bahwa menjaga seseorang tidak berarti memiliki masa depannya.',
'Bran selalu datang membawa perisai cadangan. Ia pernah terlambat satu kali dan tidak bisa menjelaskan mengapa rasa bersalah itu terasa lebih tua dari dirinya. Ia ingin sebuah kemenangan yang tidak meninggalkan siapa pun.',
'Sable mencuri benda yang pemiliknya mengaku tidak pernah punya. Ia menyimpan kuitansi, bukan trofi. Di kota yang bisa melupakan kontrak, seorang pencuri mungkin menjadi satu-satunya saksi yang menyimpan bukti.',
'Rowan mengenali setiap burung dari nadanya. Ketika harga sebuah penyeberangan adalah lagu ibunya, ia harus memilih antara mendapatkan masa lalunya kembali atau memberi orang lain jalan pulang.',
'Lyra selalu tahu obat untuk luka yang belum pernah ia lihat. Ia takut kebaikannya hanya perintah yang ditanamkan. Kisahnya bukan mencari bukti bahwa ia pernah manusia, tetapi memilih apa yang akan ia lakukan hari ini.',
'Kestrel membawa lonceng kecil yang tak terhubung ke menara. Ia mengajari warga bahwa tanda bahaya dapat menjadi ajakan saling menjaga, bukan perintah untuk menyerahkan pilihan.',
'Nyx adalah pengukir yang mengingat bengkel sebelum bangunannya ada. Ia menulis nama-nama di bahan yang sulit dihapus. Keahliannya memberi bentuk pada hal-hal yang baru berani memilih untuk ada.',
'Orin menulis prediksi di buku yang terus mengoreksi dirinya sendiri. Ia terpaksa memilih antara peta yang selalu benar dan masa depan yang belum ditentukan. Hal paling berani yang ia lakukan adalah menutup bukunya.',
'Mira merawat hal-hal kecil: obat, jalur evakuasi, kursi sekolah yang kosong. Ketika para pahlawan sibuk memecahkan rahasia, ia membangun cara hidup yang tidak perlu mengorbankan seseorang agar terasa aman.',
];
export const CHARACTERS=ROSTER.map((r,id)=>({id,...r,bio:bios[id],recruitChapter:id===0||id===4||id===3?0:id===2?1:id===7?2:id===1||id===5?3:4}));
