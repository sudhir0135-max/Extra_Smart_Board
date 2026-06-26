import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadImageToStorage(file: File, folder: string = 'images'): Promise<string> {
  const fileName = `${Date.now()}_${file.name}`;
  const fileRef = ref(storage, `${folder}/${fileName}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

export async function uploadPdfToStorage(file: File): Promise<string> {
  const fileName = `${Date.now()}_${file.name}`;
  const fileRef = ref(storage, `pdfs/${fileName}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}
