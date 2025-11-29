# WFiIS_3D_Aquarium
Joanna Hełdak

# Opis funkcjonalności
Aplikacja przedstawia zachowanie stadne ryb w oparciu o algorytm Boids. 

### Logika ruchu ryb
Każda ryba porusza się autonomicznie, podejmując decyzję o kierunku ruch w czasie rzeczywistym na podstawie zasad jak: separacja od innych ryb (separation), dostosowanie kierunku i prędkości do średniej prędkości stada ( alignment ), spójność ruchu grupy (cohesion). W akwarium znajdują się dwa gatunki ryb. Ryby łączą się w ławicę w zakresie własnego gatunku. 

### Grafika
Wszystkie obiekty są pokryte teksturą. Dodatkowo woda posiada shadery falowania. Dodatkowo dodana efekt bąbelek.

### Iterakcja użytkownika
Obrót i przybliżanie kamery ( myszka + scroll ) oraz strzałki (Góra/Dół = przód/tył, Lewo/Prawo - obrót).
Uzytkownik może również zmieniać parametry symulacji poprzez panel w górnym prawym narożniku.


# Instrukcja uruchomienia

Po sklonowaniu kodu repozytorium i upewnieniu się, że posiadamy zainstalowane środowisko Node.js oraz menager pakietów npm.  
Pobieramy potrzebne biblioteki do uruchomienia aplikacji:

```bash
npm install
```

Uruchamiamy serwer deweloerski:
```bash
npx vite 
```

Otwieramy domyślny URL http://localhost:5173 aby zobaczyć apliakcję w trybie podglądu.

# Użyte biblioteki
Three.js  
lil-gui  
Vite

# Użyte assety
Modele oraz tekstury dla rybek: https://free3d.com/3d-model/long-fin-white-cloud-v1--576023.html  
Reszta tekstur: zasoby znalezione przez wyszukiwarkę Google Images

# Link do filmiku


