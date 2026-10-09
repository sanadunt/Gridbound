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
'Tamsin menyanyikan lagu yang tidak diingat siapa pun di Emberhollow, lengkap dengan bait tentang tujuh belas anak yang hilang. Ia bukan saksi; ia hanya tidak pernah membayar lonceng dengan ingatannya. Lagunya menjadi arsip yang bisa berjalan.',
'Vesper dulu memungut ongkos ingatan di Feri Kaca. Ia tahu rasa setiap kenangan yang pernah dijual penumpang, dan membenci dirinya karena menikmatinya. Kutukannya adalah cara mengembalikan beban kepada yang menciptakannya.',
'Pell memperbaiki jam kota sejak umur sembilan dan diam-diam menulis catatan di setiap roda gigi. Di bangsal paduan suara, Pell menemukan bahwa mesin yang dirawatnya ikut menyimpan nyawa. Sekarang Pell membangun alat yang bisa dimatikan siapa saja.',
'Koa bertapa di Frostward, menghitung napas agar tidak menghitung hari. Ia menulis surat untuk party di putaran sebelumnya dan lupa pernah mengirimnya. Tinjunya pelan, tetapi tidak pernah ragu.',
'Ilse bernyanyi di pemakaman tanpa nama, untuk orang-orang yang belum meninggal. Ia percaya lagu duka bisa menjadi janji: kita akan berusaha agar lagu ini tidak pernah dibutuhkan.',
'Hale memimpin bengkel Koperasi Hearth dan mengubah lonceng-lonceng kecil menjadi alarm, pompa, dan pemanas. Baginya keselamatan adalah pekerjaan bersama yang membosankan, dan justru karena itu ia mempercayainya.',
];
/** What each hero says on joining the party (shown as a scene after the recruiting chapter). */
const joins=[
'Aku tidak ingat siapa yang pertama kulindungi. Biarlah kalian yang berikutnya.',
'Aku terlambat sekali, dulu. Kali ini aku datang lebih awal dan membawa perisai cadangan.',
'Kuitansi ini menyebut kalian berutang padaku. Tenang, aku menagihnya dengan bertarung di sisimu.',
'Burung-burung di jalan setapak terdiam. Aku ikut, sampai mereka bernyanyi lagi.',
'Aku tahu obat untuk luka yang belum kalian dapat. Mari pastikan aku tidak perlu memakainya.',
'Lonceng kecilku tidak memerintah siapa pun. Ia hanya memanggil, dan aku menjawab.',
'Kuukir nama kalian di batu yang sulit dihapus. Sekarang aku harus memastikan nama itu tetap hidup.',
'Buku ini sudah menulis akhir cerita kita. Aku ikut untuk membuktikannya salah.',
'Kursi sekolah masih kosong. Aku ikut supaya ada yang pulang untuk mengisinya.',
'Lagu ini punya tujuh belas bait, satu untuk setiap anak. Aku akan menyanyikannya sampai kalian ingat.',
'Aku pernah menjual ongkos ingatan. Sekarang aku menagihnya kembali dari yang menetapkan harganya.',
'Setiap roda gigi yang kubuat punya tombol mati. Itu janjiku pada kalian.',
'Aku berhenti menghitung hari dan mulai menghitung napas. Napas berikutnya untuk perjalanan ini.',
'Aku menyanyi untuk orang yang belum meninggal. Bantu aku membuat lagu itu tidak pernah dibutuhkan.',
'Kota tanpa lonceng tetap butuh tanda bahaya. Aku membangunnya, dan kali ini setiap orang bisa mematikannya.',
];
export const CHARACTERS=ROSTER.map((r,id)=>({id,...r,bio:bios[id],joinLine:joins[id],recruitChapter:id===0||id===4||id===3?0:id===2?1:id===7?2:id===1||id===5?3:id<=8?4:[5,6,7,9,11,13][id-9]}));
