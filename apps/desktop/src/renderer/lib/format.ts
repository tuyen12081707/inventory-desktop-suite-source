export const numberFormat = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

export const currencyFormat = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});
