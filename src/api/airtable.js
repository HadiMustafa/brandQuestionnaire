// src/api/airtable.js
import axios from "axios";

const apiKey = import.meta.env.VITE_AIRTABLE_API_KEY;
const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
const tableName = import.meta.env.VITE_AIRTABLE_TABLE_NAME;

const airtable = axios.create({
  baseURL: `https://api.airtable.com/v0/${baseId}/${tableName}`,
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
});

export const addRecord = async (data) => {
  const record = { fields: data };
  const response = await airtable.post("", record);
  return response.data;
};
