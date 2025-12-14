// 도서관 좌석/예약 프런트엔드 서비스 (localStorage 기반 모킹)
(function(global){
  const STORAGE_KEY = 'library_state_v1';

  const ROOMS = [
    { id: 'main-reading', buildingId: 'main', buildingName: '본관', name: '본관 열람실', rows: 3, cols: 4 },
    { id: 'main-study', buildingId: 'main', buildingName: '본관', name: '본관 스터디룸', rows: 2, cols: 3 },
    { id: 'annex-1-reading', buildingId: 'annex', buildingName: '별관', name: '별관 1층 열람실', rows: 3, cols: 5 },
    { id: 'annex-1-laptop', buildingId: 'annex', buildingName: '별관', name: '별관 1층 노트북열람실', rows: 2, cols: 4 },
    { id: 'annex-2-reading', buildingId: 'annex', buildingName: '별관', name: '별관 2층 열람실', rows: 3, cols: 4 },
    { id: 'annex-2-laptop', buildingId: 'annex', buildingName: '별관', name: '별관 2층 노트북열람실', rows: 2, cols: 4 },
  ];

  function seatLabel(r, c){
    return String.fromCharCode(65 + r) + (c + 1);
  }

  function seedState(){
    const seats = [];
    ROOMS.forEach(room => {
      for (let r = 0; r < room.rows; r++){
        for (let c = 0; c < room.cols; c++){
          const label = seatLabel(r, c);
          seats.push({
            id: `${room.id}-${label}`,
            buildingId: room.buildingId,
            buildingName: room.buildingName,
            roomId: room.id,
            roomName: room.name,
            label,
            reservedBy: null,
            reservedAt: null
          });
        }
      }
    });
    return { seats, reservations: [] };
  }

  function readState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded = seedState();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.seats) throw new Error('Invalid state');
      return parsed;
    } catch {
      const seeded = seedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
  }

  function writeState(state){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function summary(){
    const { seats } = readState();
    const initial = {
      main: { current: 0, max: 0, rooms: {} },
      annex: { current: 0, max: 0, rooms: {} }
    };
    seats.forEach(seat => {
      const bucket = initial[seat.buildingId];
      if (!bucket) return;
      bucket.max += 1;
      const roomKey = seat.roomId;
      if (!bucket.rooms[roomKey]) bucket.rooms[roomKey] = { current: 0, max: 0, roomName: seat.roomName };
      bucket.rooms[roomKey].max += 1;
      if (seat.reservedBy){
        bucket.current += 1;
        bucket.rooms[roomKey].current += 1;
      }
    });
    return initial;
  }

  function listRooms(buildingId){
    const { seats } = readState();
    const rooms = ROOMS.filter(r => !buildingId || r.buildingId === buildingId);
    return rooms.map(room => {
      const roomSeats = seats.filter(s => s.roomId === room.id);
      return {
        ...room,
        seats: roomSeats,
        summary: {
          max: roomSeats.length,
          current: roomSeats.filter(s => s.reservedBy).length
        }
      };
    });
  }

  function listSeatMap(buildingId){
    const { seats } = readState();
    const rooms = ROOMS.filter(r => !buildingId || r.buildingId === buildingId);
    return rooms.map(room => {
      const roomSeats = seats.filter(s => s.roomId === room.id);
      const grid = [];
      for (let r = 0; r < room.rows; r++){
        const row = [];
        for (let c = 0; c < room.cols; c++){
          const label = seatLabel(r, c);
          row.push(roomSeats.find(s => s.label === label));
        }
        grid.push(row);
      }
      return { ...room, grid, seats: roomSeats };
    });
  }

  function reserveSeat({ seatId, user }){
    const state = readState();
    const seat = state.seats.find(s => s.id === seatId);
    if (!seat) return { ok: false, reason: 'not-found' };
    if (seat.reservedBy) return { ok: false, reason: 'occupied' };
    seat.reservedBy = user.email;
    seat.reservedAt = Date.now();
    const reservation = {
      id: `res-${Date.now()}-${seatId}`,
      seatId: seat.id,
      seatLabel: seat.label,
      buildingId: seat.buildingId,
      buildingName: seat.buildingName,
      roomId: seat.roomId,
      roomName: seat.roomName,
      userEmail: user.email,
      userName: user.name || user.email,
      reservedAt: seat.reservedAt,
      cancelledAt: null,
      status: 'active'
    };
    state.reservations.push(reservation);
    writeState(state);
    return { ok: true, reservation, seat };
  }

  function cancelReservation(reservationId, userEmail){
    const state = readState();
    const reservation = state.reservations.find(r => r.id === reservationId);
    if (!reservation) return { ok: false, reason: 'not-found' };
    if (reservation.userEmail !== userEmail) return { ok: false, reason: 'forbidden' };
    if (reservation.status === 'cancelled') return { ok: false, reason: 'already-cancelled' };
    const seat = state.seats.find(s => s.id === reservation.seatId);
    if (seat) {
      seat.reservedBy = null;
      seat.reservedAt = null;
    }
    reservation.status = 'cancelled';
    reservation.cancelledAt = Date.now();
    writeState(state);
    return { ok: true, reservation };
  }

  function listUserReservations(userEmail){
    const state = readState();
    return state.reservations
      .filter(r => r.userEmail === userEmail)
      .sort((a, b) => b.reservedAt - a.reservedAt);
  }

  function getSeatById(seatId){
    const state = readState();
    return state.seats.find(s => s.id === seatId) || null;
  }

  // 사용자 맞춤 데이터 반환 함수
  function getUserDashboard(userEmail){
    const reservations = listUserReservations(userEmail);
    const stats = summary();
    
    // 활성 예약 (예약 중인 좌석)
    const activeReservation = reservations.find(r => r.status === 'active');
    
    // 최근 취소된 예약
    const recentCancelled = reservations.filter(r => r.status === 'cancelled').slice(0, 3);
    
    // 자주 사용하는 열람실 (통계)
    const roomUsageMap = {};
    reservations.forEach(r => {
      roomUsageMap[r.roomId] = (roomUsageMap[r.roomId] || 0) + 1;
    });
    const frequentRoom = Object.entries(roomUsageMap)
      .sort((a, b) => b[1] - a[1])
      .map(([roomId, count]) => {
        const rooms = listRooms();
        const room = rooms.find(r => r.id === roomId);
        return { roomId, roomName: room?.name, count };
      })[0];
    
    // 다음 예약 (예정된 예약)
    const upcomingReservation = reservations.find(r => r.status === 'active');
    
    return {
      userEmail,
      totalReservations: reservations.length,
      activeReservation,
      recentCancelled,
      frequentRoom,
      upcomingReservation,
      seatStats: stats
    };
  }

  // 사용자의 예약 통계
  function getUserStats(userEmail){
    const reservations = listUserReservations(userEmail);
    const cancelled = reservations.filter(r => r.status === 'cancelled').length;
    const active = reservations.filter(r => r.status === 'active').length;
    
    return {
      total: reservations.length,
      active,
      cancelled,
      cancellationRate: reservations.length > 0 ? ((cancelled / reservations.length) * 100).toFixed(1) : 0
    };
  }

  global.Library = {
    summary,
    listRooms,
    listSeatMap,
    reserveSeat,
    cancelReservation,
    listUserReservations,
    getSeatById,
    getUserDashboard,
    getUserStats
  };
})(window);
