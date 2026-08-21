'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from 'react';
import SectionHeading from './SectionHeading';

type LibraryKind = 'PUBLIC_LIBRARY' | 'PUBLIC_SMALL' | 'PRIVATE_SMALL';

type RecentProgram = {
  sourceId: number;
  title: string;
  libraryName: string | null;
  targetGroup: string | null;
  sourceUrl: string;
  occurrenceLabel: string | null;
  capacity: number | null;
  capacityText: string | null;
  programStartDate: string | null;
  programEndDate: string | null;
  applyStartDate: string | null;
  applyEndDate: string | null;
};

type Library = {
  id: string;
  name: string;
  kind: LibraryKind;
  kindLabel: string;
  district: string;
  address: string;
  geocodeAddress: string;
  phone?: string;
  openHours?: string;
  sourceUrl: string;
  recentPrograms: RecentProgram[];
};

type LibrariesApiResponse = {
  libraries: Library[];
  total: number;
  query: string;
  error?: string;
};

type KakaoStatus = 'OK' | 'ZERO_RESULT' | 'ERROR';
type KakaoLatLng = { getLat(): number; getLng(): number };
type KakaoMap = { setCenter(position: KakaoLatLng): void; setZoomable(zoomable: boolean): void };
type KakaoMarker = { setMap(map: KakaoMap | null): void };
type KakaoGeocoderResult = { x: string; y: string };
type KakaoPlacesResult = { x: string; y: string };
type KakaoGeocoder = {
  addressSearch(address: string, callback: (result: KakaoGeocoderResult[], status: KakaoStatus) => void): void;
};
type KakaoPlaces = {
  keywordSearch(
    keyword: string,
    callback: (result: KakaoPlacesResult[], status: KakaoStatus) => void,
    options?: { location?: KakaoLatLng; radius?: number },
  ): void;
};
type KakaoNamespace = {
  maps: {
    load(callback: () => void): void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
    Marker: new (options: { map: KakaoMap; position: KakaoLatLng }) => KakaoMarker;
    services: {
      Status: { OK: 'OK'; ZERO_RESULT: 'ZERO_RESULT'; ERROR: 'ERROR' };
      Geocoder: new () => KakaoGeocoder;
      Places: new () => KakaoPlaces;
    };
    event: { addListener(target: KakaoMarker, eventName: string, handler: () => void): void };
  };
};

declare global {
  interface Window {
    kakao?: KakaoNamespace;
    __kakaoMapsReadyPromise?: Promise<KakaoNamespace>;
  }
}

type MarkerLocation = {
  lat: number;
  lng: number;
};

const KAKAO_SDK_ID = 'kakao-map-sdk';
const GEUMJEONG_CENTER = { lat: 35.243, lng: 129.092 };

function getKakaoMapApiKey() {
  return process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY?.trim() ?? '';
}

function loadKakaoMaps(apiKey: string) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Kakao maps can only load in the browser.'));
  }

  if (window.__kakaoMapsReadyPromise) return window.__kakaoMapsReadyPromise;

  window.__kakaoMapsReadyPromise = new Promise((resolve, reject) => {
    const finishLoading = () => {
      const kakao = window.kakao;
      if (!kakao) {
        reject(new Error('Kakao maps SDK did not initialize.'));
        return;
      }

      kakao.maps.load(() => resolve(kakao));
    };

    const existingScript = document.getElementById(KAKAO_SDK_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.kakao) {
        finishLoading();
        return;
      }

      existingScript.addEventListener('load', finishLoading, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Kakao maps SDK failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = KAKAO_SDK_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(apiKey)}&libraries=services&autoload=false`;
    script.addEventListener('load', finishLoading, { once: true });
    script.addEventListener('error', () => reject(new Error('Kakao maps SDK failed to load.')), { once: true });
    document.head.appendChild(script);
  });

  return window.__kakaoMapsReadyPromise;
}

function findByAddress(kakao: KakaoNamespace, geocoder: KakaoGeocoder, address: string) {
  return new Promise<KakaoLatLng | null>((resolve) => {
    geocoder.addressSearch(address, (result, status) => {
      if (status !== kakao.maps.services.Status.OK || !result[0]) {
        resolve(null);
        return;
      }

      resolve(new kakao.maps.LatLng(Number(result[0].y), Number(result[0].x)));
    });
  });
}

function findByKeyword(kakao: KakaoNamespace, places: KakaoPlaces, library: Library) {
  const center = new kakao.maps.LatLng(GEUMJEONG_CENTER.lat, GEUMJEONG_CENTER.lng);

  return new Promise<KakaoLatLng | null>((resolve) => {
    places.keywordSearch(
      `${library.name} ${library.geocodeAddress}`,
      (result, status) => {
        if (status !== kakao.maps.services.Status.OK || !result[0]) {
          resolve(null);
          return;
        }

        resolve(new kakao.maps.LatLng(Number(result[0].y), Number(result[0].x)));
      },
      { location: center, radius: 20000 },
    );
  });
}

async function locateLibrary(
  kakao: KakaoNamespace,
  geocoder: KakaoGeocoder,
  places: KakaoPlaces,
  library: Library,
) {
  return (await findByAddress(kakao, geocoder, library.geocodeAddress)) ?? findByKeyword(kakao, places, library);
}

function formatDate(value: string | null) {
  if (!value) return '';

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${Number(match[2])}.${Number(match[3])}.`;
}

function formatProgramPeriod(program: RecentProgram) {
  const start = formatDate(program.programStartDate);
  const end = formatDate(program.programEndDate);

  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end || program.occurrenceLabel || '일정 확인 필요';
}

function formatCapacity(program: RecentProgram) {
  if (program.capacityText) return program.capacityText;
  if (typeof program.capacity === 'number') return `${program.capacity}명`;
  return null;
}

function buildLibraryQueryUrl(query: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());

  const search = params.toString();
  return search ? `/api/libraries?${search}` : '/api/libraries';
}

export default function LibraryFinderSection() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [mapStatus, setMapStatus] = useState('지도를 준비하는 중입니다.');
  const [markerLocations, setMarkerLocations] = useState<Record<string, MarkerLocation>>({});
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);
  const kakaoMapApiKey = getKakaoMapApiKey();

  const selectedLibrary = useMemo(
    () => libraries.find((library) => library.id === selectedId) ?? libraries[0] ?? null,
    [libraries, selectedId],
  );

  useEffect(() => {
    const panel = mapPanelRef.current;
    if (!panel) return;

    const keepWheelInsideMap = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    panel.addEventListener('wheel', keepWheelInsideMap, { passive: false });

    return () => panel.removeEventListener('wheel', keepWheelInsideMap);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLibraries() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(buildLibraryQueryUrl(submittedQuery), {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json()) as LibrariesApiResponse;

        if (!response.ok) throw new Error(payload.error ?? '도서관 목록을 불러오지 못했습니다.');

        setLibraries(payload.libraries);
        setSelectedId((current) =>
          current && payload.libraries.some((library) => library.id === current)
            ? current
            : payload.libraries[0]?.id ?? null,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setLibraries([]);
        setSelectedId(null);
        setErrorMessage(error instanceof Error ? error.message : '도서관 목록을 불러오지 못했습니다.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadLibraries();

    return () => controller.abort();
  }, [submittedQuery]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (!kakaoMapApiKey) {
      setMapStatus('지도 키 설정을 확인해 주세요.');
      setMarkerLocations({});
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      return;
    }

    let cancelled = false;

    async function renderMap() {
      setMapStatus(libraries.length ? '도서관 위치를 찾는 중입니다.' : '표시할 도서관이 없습니다.');

      const kakao = await loadKakaoMaps(kakaoMapApiKey);
      if (cancelled || !mapContainerRef.current) return;

      const center = new kakao.maps.LatLng(GEUMJEONG_CENTER.lat, GEUMJEONG_CENTER.lng);
      const map = mapRef.current ?? new kakao.maps.Map(mapContainerRef.current, { center, level: 7 });
      mapRef.current = map;
      map.setZoomable(false);

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];

      if (!libraries.length) {
        setMarkerLocations({});
        return;
      }

      const geocoder = new kakao.maps.services.Geocoder();
      const places = new kakao.maps.services.Places();
      const locations = await Promise.all(
        libraries.map(async (library) => ({
          library,
          position: await locateLibrary(kakao, geocoder, places, library),
        })),
      );

      if (cancelled) return;

      const nextMarkerLocations: Record<string, MarkerLocation> = {};
      const firstPosition = locations.find(({ position }) => position)?.position ?? center;

      locations.forEach(({ library, position }) => {
        if (!position) return;

        nextMarkerLocations[library.id] = { lat: position.getLat(), lng: position.getLng() };

        const marker = new kakao.maps.Marker({ map, position });
        kakao.maps.event.addListener(marker, 'click', () => {
          setSelectedId(library.id);
          map.setCenter(position);
        });
        markersRef.current.push(marker);
      });

      setMarkerLocations(nextMarkerLocations);
      map.setCenter(firstPosition);
      setMapStatus(`${Object.keys(nextMarkerLocations).length}곳의 위치를 표시 중입니다.`);
    }

    renderMap().catch(() => {
      if (!cancelled) setMapStatus('지도를 불러오지 못했습니다.');
    });

    return () => {
      cancelled = true;
    };
  }, [kakaoMapApiKey, libraries]);

  useEffect(() => {
    const location = selectedId ? markerLocations[selectedId] : null;
    const kakao = window.kakao;
    const map = mapRef.current;

    if (!location || !kakao || !map) return;

    map.setCenter(new kakao.maps.LatLng(location.lat, location.lng));
  }, [markerLocations, selectedId]);

  return (
    <section className="homeSection libraryFinderSection" id="library-finder">
      <div className="uiContainer libraryFinderGrid">
        <div className="libraryFinderContent">
          <SectionHeading
            eyebrow="LIBRARY NEAR YOU"
            title="우리 동네 작은도서관 찾기"
            description="부산 금정구 도서관을 검색하고 위치와 최근 프로그램을 함께 확인해 보세요."
          />
          <form
            className="librarySearch"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedQuery(query);
            }}
          >
            <label htmlFor="library-search">지역 또는 도서관명</label>
            <div>
              <input
                id="library-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="예: 금샘, 구서, 부곡"
              />
              <button className="uiButton uiButtonPrimary" type="submit">
                도서관 찾기
              </button>
            </div>
          </form>
          <div ref={mapPanelRef} className="libraryMapPanel">
            <div ref={mapContainerRef} className="libraryMap" role="img" aria-label="금정구 도서관 위치 지도" />
            <p className="libraryMapStatus">{mapStatus}</p>
            {selectedLibrary ? (
              <div className="librarySelected">
                <span>{selectedLibrary.kindLabel}</span>
                <strong>{selectedLibrary.name}</strong>
                <p>{selectedLibrary.address}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="libraryFinderExplorer">
          <div className="libraryResultsHeader">
            <strong>{isLoading ? '검색 중' : `${libraries.length}곳`}</strong>
            {submittedQuery ? <span>&quot;{submittedQuery}&quot; 검색 결과</span> : <span>금정구 도서관</span>}
          </div>

          <div className="libraryResults" aria-live="polite" aria-busy={isLoading}>
            {isLoading ? <p className="libraryEmpty">도서관 목록을 불러오는 중입니다.</p> : null}
            {!isLoading && errorMessage ? <p className="libraryEmpty">{errorMessage}</p> : null}
            {!isLoading && !errorMessage && !libraries.length ? (
              <p className="libraryEmpty">일치하는 도서관이 없습니다. 다른 검색어를 입력해 주세요.</p>
            ) : null}
            {!isLoading && !errorMessage
              ? libraries.map((library, index) => (
                  <article className={library.id === selectedId ? 'isSelected' : undefined} key={library.id}>
                    <span className="libraryPin" aria-hidden="true">{index + 1}</span>
                    <div>
                      <div className="libraryCardHeader">
                        <span>{library.kindLabel}</span>
                        <button type="button" onClick={() => setSelectedId(library.id)}>
                          지도 보기
                        </button>
                      </div>
                      <h3>{library.name}</h3>
                      <p>{library.address}</p>
                      <dl className="libraryMeta">
                        {library.openHours ? (
                          <>
                            <dt>운영</dt>
                            <dd>{library.openHours}</dd>
                          </>
                        ) : null}
                        {library.phone ? (
                          <>
                            <dt>문의</dt>
                            <dd>{library.phone}</dd>
                          </>
                        ) : null}
                      </dl>
                      <div className="libraryPrograms">
                        <strong>최근 프로그램</strong>
                        {library.recentPrograms.length ? (
                          <ul>
                            {library.recentPrograms.map((program) => {
                              const capacity = formatCapacity(program);

                              return (
                                <li key={program.sourceId}>
                                  <a href={program.sourceUrl} target="_blank" rel="noreferrer">
                                    {program.title}
                                  </a>
                                  <span>
                                    {formatProgramPeriod(program)}
                                    {program.targetGroup ? ` · ${program.targetGroup}` : ''}
                                    {capacity ? ` · ${capacity}` : ''}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p>최근 프로그램 정보가 아직 없습니다.</p>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              : null}
          </div>
        </div>
      </div>
    </section>
  );
}
