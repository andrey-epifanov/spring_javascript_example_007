# Spring JavaScript Example 007

Демо-проект: страница иерархии timesheets (Spring Boot + Thymeleaf + JavaScript).

## Запуск

```bash
mvn spring-boot:run
```

Открыть: http://localhost:8080/timesheets-hierarchy

## API

- `GET /timesheets-hierarchy` — HTML-страница
- `GET /timesheets-hierarchy/api/timesheet-hierarchy?dateFrom=...&dateTo=...` — JSON-иерархия из `data/timesheet-hierarchy-sample.json`
- `GET /timesheets/api/filters` — данные для Select2-фильтров (заглушка)
- `GET /timesheets/api/details` — детали списаний для модального окна (заглушка)

## Структура иерархии (3 уровня)

1. **Уровень 0** — Павел Иванов (директор)
2. **Уровень 1** — руководители отделов (Сидоров, Волков)
3. **Уровень 2** — сотрудники (Петров, Козлов, Морозов)

Пример JSON: `src/main/resources/data/timesheet-hierarchy-sample.json`
