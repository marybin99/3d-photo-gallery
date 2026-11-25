export type RoomId = string;

export type RoomNames = Record<string, string>;

export type RoomRecord = {
  id: RoomId;
  name: string;
  entrance_color?: string;
  sign_text_color?: string;
  is_open: boolean;
  updated_at: string;
};
