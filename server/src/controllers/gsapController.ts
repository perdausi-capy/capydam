import { Request, Response } from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_ID = 0;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

export const getGsapAssets = async (req: Request, res: Response) => {
  if (!PRIVATE_KEY || !CLIENT_EMAIL || !SPREADSHEET_ID) return res.status(500).json({ error: 'Server config error' });

  try {
    const jwt = new JWT({ email: CLIENT_EMAIL, key: PRIVATE_KEY.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, jwt);
    await doc.loadInfo();
    let sheet = doc.sheetsById[SHEET_ID];
    if (!sheet) { sheet = await doc.addSheet({ sheetId: SHEET_ID, title: 'GSAP Library' }); await sheet.setHeaderRow(['id', 'title', 'description', 'documentationUrl', 'codeSnippet', 'variables', 'embedVideo', 'likes', 'image', 'dateAdded']); }

    // --- GET ---
    if (req.method === 'GET') {
      const rows = await sheet.getRows();
      const data = rows.map((row) => ({
        id: row.get('id') || '',
        title: row.get('title') || '',
        description: row.get('description') || '',
        documentationUrl: row.get('documentationUrl') || '',
        codeSnippet: row.get('codeSnippet') || '',
        variables: row.get('variables') || '',
        embedVideo: row.get('embedVideo') || '',
        image: row.get('image') || '',
        likes: parseInt(row.get('likes') || '0', 10),
        rowIndex: row.rowNumber - 2 
      }));
      return res.status(200).json(data);
    } 
    
    // --- POST ---
    else if (req.method === 'POST') {
      const newRow = { ...req.body, id: Date.now().toString(), dateAdded: new Date().toISOString(), likes: '0' };
      await sheet.addRow(newRow);
      return res.status(200).json({ message: 'Added' });
    }

    // --- PUT (Update / Like) ---
    else if (req.method === 'PUT') {
      const { index, action, ...updates } = req.body;
      const rows = await sheet.getRows();
      
      if (index === undefined || index < 0 || index >= rows.length) return res.status(400).json({ error: 'Invalid row index' });

      if (action === 'like') {
        const currentLikes = parseInt(rows[index].get('likes') || '0', 10);
        rows[index].set('likes', (currentLikes + 1).toString());
        await rows[index].save();
        return res.status(200).json({ message: 'Likes updated' });
      }

      if (action === 'update') {
        const row = rows[index];
        if (updates.title) row.set('title', updates.title);
        if (updates.description) row.set('description', updates.description);
        if (updates.codeSnippet) row.set('codeSnippet', updates.codeSnippet);
        if (updates.documentationUrl) row.set('documentationUrl', updates.documentationUrl);
        if (updates.variables) row.set('variables', updates.variables);
        if (updates.embedVideo) row.set('embedVideo', updates.embedVideo);
        if (updates.image) row.set('image', updates.image);
        await row.save();
        return res.status(200).json({ message: 'Updated' });
      }
    }

    // --- DELETE ---
    else if (req.method === 'DELETE') {
      const { index } = req.query; // Get index from URL
      const rows = await sheet.getRows();
      const rowIndex = Number(index);

      if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= rows.length) {
          return res.status(400).json({ error: 'Invalid row index' });
      }

      await rows[rowIndex].delete();
      return res.status(200).json({ message: 'Deleted' });
    }

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
};