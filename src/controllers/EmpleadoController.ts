import { Request, Response } from "express";
import AbstractController from "./AbstractController";
import db from "../models";
import { Op } from "sequelize";

class EmpleadoController extends AbstractController {
  //Singleton
  //Atributo de clase
  private static _instance: EmpleadoController;
  //Método de clase
  public static get instance(): AbstractController {
    if (!this._instance) {
      this._instance = new EmpleadoController("empleado");
    }
    return this._instance;
  }

  //Declarar todas las rutas del controlador
  protected initRoutes(): void {
    this.router.get("/test", this.getTest.bind(this));
    this.router.get(
      "/consultarEmpleados",
      this.getConsultarEmpleados.bind(this)
    );
    this.router.post("/crearEmpleado", this.postCrearEmpleado.bind(this));
    this.router.get(
      "/calificacionPromedio/:id",
      this.getCalificacionPromedio.bind(this)
    );

    // Api para mostrar el promedio de la calificacion de las llamadas de un empleado en un día
    // Ejemplo de petición:
    // GET 44.209.22.101:8080/empleado/califPromDia/2/calificaciones/2023-05-21
    this.router.get(
      "/califPromDia/:id/calificaciones/:date",
      this.getCalifPromDia.bind(this)
    ); //ERROR
    this.router.get(
      "/consultarLlamadasEmpleado/:id",
      this.getSumLlamadasEmpleado.bind(this)
    );
    this.router.get(
      "/consutarEmpleado/:id",
      this.getConsultarEmpleado.bind(this)
    );
    this.router.get(
      "/consultarPromLlamadasEmpleado/:id",
      this.getPromLlamadasEmpleado.bind(this)
    );
    this.router.get("/agentesActivos", this.agentesActivos.bind(this)); //Notificaciones
    this.router.post("/EMERGENCIA", this.EMERGENCIA.bind(this));
    this.router.get(
      "/llamadasDiaHoyEmpleado/:id/:date",
      this.getLlamadasDiaHoyEmpleado.bind(this)
    );
    this.router.get(
      "/modaDeSentimientoEmpleado/:id",
      this.getModaDeSentimientoEmpleado.bind(this)
    );
    this.router.get(
      "/leaderboardLlamadasDia/:date/:idEmpleado",
      this.getLeaderboardLlamadasDia.bind(this)
    );
    this.router.get("/leaderboardCalificacionesDia/:date/:idEmpleado", this.getLeaderboardCalificacionesDia.bind(this));
    this.router.get("/getPromedioTiempoLlamada/:id", this.getPromedioTiempoLlamada.bind(this));
    this.router.get("/getAgenteMejorCalifMes/:date", this.getAgenteMejorCalifMes.bind(this));
    this.router.get("/getAgenteMasLlamadasDia/:date", this.getAgenteMasLlamadasDia.bind(this));
    this.router.get("/getCalifPromDiaAgentes/:date", this.getCalifPromDiaAgentes.bind(this));
    this.router.get("/duracionPromMeses/:IdEmpleado", this.getDuracionPromMeses.bind(this));
  }

  private async getDuracionPromMeses(req: Request, res: Response) {
    try {

      const { IdEmpleado } = req.params;

      const whereCondition: any = {
        IdEmpleado,
        FechaHora: {
          [Op.between]: [
            db.sequelize.literal("DATE_SUB(CURDATE(), INTERVAL 5 MONTH)"),
            db.sequelize.literal("CURDATE()")
          ]
        }
      };

      const result = await db.Llamada.findAll({
        attributes: [
          [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('FechaHora'), '%m'), 'MonthNumber'],
          [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('FechaHora'), '%M'), 'Month'],
          [db.sequelize.fn('AVG', db.sequelize.col('Duracion')), 'AvgDuration']
        ],
        where: whereCondition,
        group: ['IdEmpleado', db.sequelize.fn('DATE_FORMAT', db.sequelize.col('FechaHora'), '%Y-%m')],
        order: [
          [db.sequelize.literal('MonthNumber'), 'ASC']
        ]
      });

      res.json(result);

    } catch (error: any) {
      console.log(error);
      res.status(500).send("Error interno del servidor: " + error);
  }
}

  private async getCalifPromDiaAgentes(req: Request, res: Response) {
    try {
      const { date } = req.params;
  
      // Conversión de la fecha a un formato general
      const endDate = new Date(date);
      const startDate = new Date(date);
      startDate.setMonth(startDate.getMonth() - 1);
  
      // Obtener todas las llamadas y las calificaciones de encuestas en el rango de fechas específico
      const llamadasCalif = await db.Llamada.findAll({
        where: {
          FechaHora: {
            [Op.between]: [startDate, endDate],
          },
        },
        include: [
          {
            model: db.Encuesta,
            as: "Encuesta",
            attributes: ["Calificacion"],
          },
          {
            model: db.Empleado,
            as: "Empleado",
            attributes: ["Nombre", "ApellidoP"],
          }
        ],
      });
  
      if (llamadasCalif.length === 0) {
        return res
          .status(404)
          .send("No se encontraron llamadas en el rango de fechas indicado");
      }
  
      // Calcular el promedio de calificaciones para cada empleado por mes
      const empleadoCalifs: { [key: string]: { sum: number; count: number, nombre: string, apellido: string } } = {};
  
      for (const llamada of llamadasCalif) {
        if (llamada.Encuesta && llamada.Empleado) {
          const idEmpleado = llamada.IdEmpleado;
          const nombre = llamada.Empleado.Nombre;
          const apellido = llamada.Empleado.ApellidoP;
          if (!empleadoCalifs[idEmpleado]) {
            empleadoCalifs[idEmpleado] = { sum: 0, count: 0, nombre, apellido };
          }
          empleadoCalifs[idEmpleado].sum += llamada.Encuesta.Calificacion;
          empleadoCalifs[idEmpleado].count += 1;
        }
      }
  
      // Formatear los datos para la respuesta
      const formattedData = Object.keys(empleadoCalifs).map(idEmpleado => {
        const { sum, count, nombre, apellido } = empleadoCalifs[idEmpleado];
        return {
          agente: `${nombre} ${apellido}`,
          value: (sum / count).toFixed(2) // Formatear el promedio a 2 decimales
        };
      });
  
      res.status(200).json(formattedData);
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Error interno del servidor: " + error);
    }
  }

  private async getAgenteMasLlamadasDia(req: Request, res: Response) {
    try {
      const { date } = req.params;
  
      // Conversión de la fecha a un formato general
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
  
      // Obtener el ID del empleado con más llamadas en el día
      const idEmpleadoLlamadas = await db.Llamada.findAll({
        where: {
          FechaHora: {
            [Op.between]: [startDate, endDate],
          },
        },
        attributes: [
          "IdEmpleado",
          [db.sequelize.fn("COUNT", "IdEmpleado"), "count"],
        ],
        group: ["IdEmpleado"],
        order: [[db.sequelize.literal("count"), "DESC"]],
        limit: 1,
      });
  
      if (idEmpleadoLlamadas.length === 0) {
        return res.status(404).send("No se encontraron llamadas en la fecha indicada");
      }
  
      const idEmpleado = idEmpleadoLlamadas[0].IdEmpleado;
  
      // Obtener el nombre y apellido del empleado con más llamadas
      const empleado = await db.Empleado.findOne({
        where: { IdEmpleado: idEmpleado },
        attributes: ["Nombre", "ApellidoP"],
      });
  
      if (!empleado) {
        return res.status(404).send("Empleado no encontrado");
      }

  
      res.status(200).json({ nombre: empleado.Nombre, apellido: empleado.ApellidoP});
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error " + error);
    }
  }
  

  private async getAgenteMejorCalifMes(req: Request, res: Response) {
    try {
      const { date } = req.params;
    
      // Conversión de la fecha a un formato general
      const endDate = new Date(date);
      const startDate = new Date(date);
      startDate.setMonth(startDate.getMonth() - 1);
    
      // Obtener todas las llamadas y las calificaciones de encuestas en el rango de fechas específico
      const llamadasCalif = await db.Llamada.findAll({
        where: {
          FechaHora: {
            [Op.between]: [startDate, endDate],
          },
        },
        include: [
          {
            model: db.Encuesta,
            as: "Encuesta",
            attributes: ["Calificacion"],
          },
          {
            model: db.Empleado, // Suponiendo que la relación está definida en el modelo Llamada
            as: "Empleado",
            attributes: ["Nombre", "ApellidoP"],
          }
        ],
      });
    
      if (llamadasCalif.length === 0) {
        return res
          .status(404)
          .send("No se encontraron llamadas en el rango de fechas indicado");
      }
    
      // Calcular el promedio de calificaciones para cada empleado
      const empleadoCalifs: { [key: string]: { sum: number; count: number, nombre: string, apellido: string } } = {};
    
      for (const llamada of llamadasCalif) {
        if (llamada.Encuesta && llamada.Empleado) {
          const idEmpleado = llamada.IdEmpleado;
          const nombre = llamada.Empleado.Nombre;
          const apellido = llamada.Empleado.ApellidoP;
          if (!empleadoCalifs[idEmpleado]) {
            empleadoCalifs[idEmpleado] = { sum: 0, count: 0, nombre, apellido };
          }
          empleadoCalifs[idEmpleado].sum += llamada.Encuesta.Calificacion;
          empleadoCalifs[idEmpleado].count += 1;
        }
      }
    
      const leaderboard = Object.keys(empleadoCalifs).map((idEmpleado) => {
        const { sum, count, nombre, apellido } = empleadoCalifs[idEmpleado];
        return { idEmpleado, promedio: sum / count, nombre, apellido };
      });
    
      // Ordenar el leaderboard por el promedio de calificaciones en orden descendente
      leaderboard.sort((a, b) => b.promedio - a.promedio);
    
      // Obtener el agente con la mejor calificación
      const mejorAgente = leaderboard[0];
    
      if (!mejorAgente) {
        return res.status(404).send("No se encontró ningún agente con calificaciones");
      }
    
      res.status(200).json({ nombre: mejorAgente.nombre, apellido: mejorAgente.apellido });
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Error interno del servidor: " + error);
    }
  }
  
  

  private async getPromedioTiempoLlamada(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await db.sequelize.query(
        `SELECT AVG(Duracion) AS avgTime
        FROM Llamada
        WHERE IdEmpleado = :id;`,
        {
          type: db.sequelize.QueryTypes.SELECT,
          replacements: { id: id }
        });
  
      // Extraer avgTime del resultado
      const avgTime = result[0]?.avgTime;
  
      if (avgTime !== null && avgTime !== undefined) {
        // Convertir avgTime a minutos y segundos
        const totalSeconds = Math.round(avgTime);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
        res.status(200).json({ value: formattedTime });
      } else {
        res.status(200).json({ value: "00:00" });
      }
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error: " + err);
    }
  }

  private async getLeaderboardCalificacionesDia(req: Request, res: Response) {
    try {
      const { date, idEmpleado } = req.params;
  
      // Conversión de la fecha a un formato general
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
  
      // Obtener todas las llamadas y las calificaciones de encuestas en una fecha específica
      const llamadasCalif = await db.Llamada.findAll({
        where: {
          FechaHora: {
            [Op.between]: [startDate, endDate],
          },
        },
        include: {
          model: db.Encuesta,
          as: "Encuesta",
          attributes: ["Calificacion"],
        },
      });
  
      if (llamadasCalif.length === 0) {
        return res
          .status(404)
          .send("No se encontraron llamadas en la fecha indicada");
      }
  
      // Calcular el promedio de calificaciones para cada empleado
      const empleadoCalifs: { [key: string]: { sum: number; count: number } } = {};
  
      for (const llamada of llamadasCalif) {
        if (llamada.Encuesta) {
          const idEmpleado = llamada.IdEmpleado;
          if (!empleadoCalifs[idEmpleado]) {
            empleadoCalifs[idEmpleado] = { sum: 0, count: 0 };
          }
          empleadoCalifs[idEmpleado].sum += llamada.Encuesta.Calificacion;
          empleadoCalifs[idEmpleado].count += 1;
        }
      }
  
      const leaderboard = Object.keys(empleadoCalifs).map((idEmpleado) => {
        const { sum, count } = empleadoCalifs[idEmpleado];
        return { idEmpleado, promedio: sum / count, posicion: 0 };
      });
  
      // Ordenar el leaderboard por el promedio de calificaciones en orden descendente
      leaderboard.sort((a, b) => b.promedio - a.promedio);
  
      // Añadir la posición de cada empleado en el leaderboard
      leaderboard.forEach((entry, index) => {
        entry.posicion = index + 1;
      });
  
      // Buscar la posición del empleado específico si se proporciona el idEmpleado
      if (idEmpleado) {
      const empleadoPos = leaderboard.find(entry => entry.idEmpleado === idEmpleado);
      if (empleadoPos) {
        return res.status(200).json({ rank: empleadoPos.posicion });
      } else {
        return res.status(404).send("Empleado no encontrado en el leaderboard");
      }
    }
  
      res.status(200).json(leaderboard);
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Error interno del servidor: " + error);
    }
  }

  private async getLeaderboardLlamadasDia(req: Request, res: Response) {
    try {
      const { date, idEmpleado } = req.params;

      // Conversión de la fecha a un formato general
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      const idEmpleadoLlamadas = await db.Llamada.findAll({
        where: {
          FechaHora: {
            [Op.between]: [startDate, endDate],
          },
        },
        attributes: ["IdEmpleado"],
      });

      const idEmpleados = idEmpleadoLlamadas.map(
        (llamada: any) => llamada.IdEmpleado
      );

      console.log("idEmpleados:", idEmpleados);

      const leaderboard = await this.calculateLeaderboard(idEmpleados);

      const position = leaderboard.findIndex(
        (entry: any) => entry.nombre === idEmpleado
      );

      res.status(200).json({ rank: position + 1 });
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error " + error);
    }
  }

  private async calculateLeaderboard(nombres: any) {
    let leaderboard: { [key: string]: number } = {};

    console.log("nombres:", nombres);

    // Contar las ocurrencias de cada nombre
    for (let i = 0; i < nombres.length; i++) {
      const nombre = nombres[i];
      if (nombre) {
        if (leaderboard[nombre]) {
          leaderboard[nombre] += 1;
        } else {
          leaderboard[nombre] = 1;
        }
      }
    }

    console.log("leaderboard (before sorting):", leaderboard);

    // Convertir el objeto leaderboard en un array de objetos JSON ordenados por el número de ocurrencias en orden descendente
    let sortedLeaderboard = Object.keys(leaderboard)
      .map((nombre) => ({
        nombre: nombre,
        llamadas: leaderboard[nombre],
      }))
      .sort((a, b) => b.llamadas - a.llamadas);

    console.log("sortedLeaderboard:", sortedLeaderboard);

    return sortedLeaderboard;
  }

  private async getModaDeSentimientoEmpleado(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const empleadoId = await db.Empleado.findOne({
        where: { IdEmpleado: id },
        attributes: ["IdEmpleado"],
      });

      if (!empleadoId) {
        return res.status(404).send("El empleado no existe");
      }

      const llamadasEmpleado = await db.Llamada.findAll({
        where: { IdEmpleado: id },
        attributes: ["Sentiment"],
      });

      const sentimientos = llamadasEmpleado.map(
        (llamada: any) => llamada.Sentiment
      );

      const moda = await this.calculateMode(sentimientos);

      res.status(200).json({ value: moda });
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error " + error);
    }
  }

  private async calculateMode(sentimientos: any[]) {
    let mode = 0;
    let count = 0;

    for (let i = 0; i < sentimientos.length; i++) {
      let tempCount = 0;
      for (let j = 0; j < sentimientos.length; j++) {
        if (sentimientos[j] === sentimientos[i]) {
          tempCount++;
        }
      }
      if (tempCount > count) {
        count = tempCount;
        mode = sentimientos[i];
      }
    }

    return mode;
  }

  private async getLlamadasDiaHoyEmpleado(req: Request, res: Response) {
    try {
      const { id, date } = req.params;

      // Conversión de la fecha a un formato general
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      const llamadas = await db.Llamada.findAll({
        where: {
          IdEmpleado: id,
          FechaHora: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      // Numero de llamadas
      const numLlamadas = llamadas.length;

      res.status(200).json({ value: numLlamadas });
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error " + error);
    }
  }

  private async EMERGENCIA(req: Request, res: Response) {
    try {
      const { id, nombre, apellido } = req.body;

      const io = req.app.get("socketio");

      if (!io) {
        return res.status(500).send("Socket.io is not initialized");
      } else {
        io.emit("EMERGENCIA", { id, nombre, apellido });
        console.log("EMERGENCIA", { id, nombre, apellido });
      }
      res.status(200).send("EMERGENCIA enviada");
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error" + error);
    }
  }

  private async agentesActivos(req: Request, res: Response) {
    try {
      const llamadas = await db.sequelize.query(
        `
      SELECT 
          SUM(CASE WHEN L.Estado = 1 THEN 1 ELSE 0 END) AS Activos,
          SUM(CASE WHEN L.Estado = 0 THEN 1 ELSE 0 END) AS Inactivos
      FROM Empleado
      LEFT JOIN Llamada AS L ON L.IdEmpleado = Empleado.IdEmpleado AND L.FechaHora = (
              SELECT MAX(L2.FechaHora) 
              FROM Llamada AS L2 
              WHERE L2.IdEmpleado = Empleado.IdEmpleado)
      LEFT JOIN Cliente ON L.Celular = Cliente.Celular
      LEFT JOIN Zona ON Cliente.IdZona = Zona.IdZona
      LEFT JOIN Contrato ON Cliente.Celular = Contrato.Celular
      LEFT JOIN Paquete ON Contrato.IdPaquete = Paquete.IdPaquete
      ORDER BY Empleado.IdEmpleado;

      `,
        { type: db.sequelize.QueryTypes.SELECT }
      );

      return res.status(200).json(llamadas);
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }

  private async getConsultarEmpleado(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const empleado = await db.Empleado.findOne({
        where: { IdEmpleado: id },
      });

      if (empleado) {
        res.status(200).json(empleado);
      } else {
        res.status(404).send("El empleado no existe");
      }
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Error interno del servidor: " + error);
    }
  }

  private async getCalificacionPromedio(req: Request, res: Response) {
    try {
      //Comment
      const { id } = req.params;

      const empleado = await db.Empleado.findOne({
        where: { IdEmpleado: id },
      });

      if (!empleado) {
        return res.status(404).send("El empleado no existe");
      }

      const llamadasEmpleado = await db.Llamada.findAll({
        where: { IdEmpleado: id },
        attributes: ["IdLlamada"],
      });

      if (llamadasEmpleado && llamadasEmpleado.length > 0) {
        let sumatoriaCalificaciones = 0;
        let totalLlamadas = 0;

        for (const llamada of llamadasEmpleado) {
          const encuestasLlamada = await db.Encuesta.findAll({
            where: { IdLlamada: llamada.IdLlamada },
            attributes: ["Calificacion"],
          });

          if (encuestasLlamada && encuestasLlamada.length > 0) {
            const sumCalificacionesLlamada = encuestasLlamada.reduce(
              (sum: number, encuesta: any) => sum + encuesta.Calificacion,
              0
            );
            sumatoriaCalificaciones += sumCalificacionesLlamada;
            totalLlamadas += encuestasLlamada.length;
          }
        }

        const promedioGeneral =
          totalLlamadas > 0 ? sumatoriaCalificaciones / totalLlamadas : 0;

        res.status(200).json({ promedioGeneral });
      } else {
        res.status(404).send("No se encontraron llamadas para este empleado");
      }
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Error interno del servidor: " + error);
    }
  }

  // Función que calcula el promedio de la calificacion de las llamadas de un empleado en un día
  // -----------------------------  INICIO DE LA FUNCION CORREGIDA --------------------------------
  private async getCalifPromDia(req: Request, res: Response) {
    try {
      const { id, date } = req.params;

      const empleado = await db.Empleado.findOne({
        where: { IdEmpleado: id },
      });

      if (!empleado) {
        return res.status(404).send("El empleado no existe");
      }

      // Conversión de la fecha a un formato general
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      // Obtener las llamadas y las califs en una fecha específica
      const llamadasCalif = await db.Llamada.findAll({
        where: {
          IdEmpleado: id,
          FechaHora: {
            [Op.between]: [startDate, endDate],
          },
        },
        include: {
          model: db.Encuesta,
          as: "Encuesta",
          attributes: ["Calificacion"],
        },
      });

      if (llamadasCalif.length === 0) {
        return res
          .status(404)
          .send(
            "No se encontraron llamadas para este empleado en la fecha indicada"
          );
      }

      // calcular el promedio de calificaciones
      let sumCalifs = 0;
      let totalCalifs = 0;

      for (const llamada of llamadasCalif) {
        if (llamada.Encuesta) {
          // Check if Encuesta exists for the llamada
          sumCalifs += llamada.Encuesta.Calificacion;
          totalCalifs++;
        }
      }

      const promGeneral = totalCalifs > 0 ? sumCalifs / totalCalifs : 0;
      res.status(200).json({ value: promGeneral });
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Error interno del servidor: " + error);
    }
  }
  // -----------------------------  FIN DE LA FUNCION CORREGIDA --------------------------------

  private getTest(req: Request, res: Response) {
    try {
      console.log("Prueba exitosa");
      res.status(200).send("<h1>Prueba exitosa</h1>");
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server errorError" + error);
    }
  }

  private async getSumLlamadasEmpleado(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const llamadas = await db.Llamada.findAll({
        where: { IdEmpleado: id }, // Busca las llamadas del empleado
        attributes: [
          "IdEmpleado", // Selecciona el id del empleado
          [
            db.Sequelize.fn("COUNT", db.Sequelize.col("IdLlamada")),
            "NumeroLlamadas",
          ], // Cuenta el número de llamadas
        ],
        group: ["IdEmpleado"], // Agrupa por empleado
      });

      if (llamadas && llamadas.length > 0) {
        // Si hay llamadas...
        res.status(200).json(llamadas); // ... manda las llamadas.
      } else {
        res.status(404).send("Empleado no encontrado"); // Si no, manda un error.
      }
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error" + error); // Error interno del servidor.
    }
  }

  // Función que calcula el promedio de la duración de las llamadas de un empleado
  private async getPromLlamadasEmpleado(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const llamadas = await db.Llamada.findAll({
        where: { IdEmpleado: id }, // Busca las llamadas del empleado
        attributes: [
          "IdEmpleado", // Selecciona el id del empleado
          [
            db.Sequelize.fn("AVG", db.Sequelize.col("Duracion")),
            "PromLlamadas",
          ], // Calcula el promedio de la duración de las llamadas
        ],
        group: ["IdEmpleado"], // Agrupa por empleado
      });

      if (llamadas && llamadas.length > 0) {
        // Si hay llamadas...
        res.status(200).json(llamadas); // ... manda las llamadas.
      } else {
        res.status(404).send("Empleado no encontrado"); // Si no, manda un error.
      }
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error" + error); // Error interno del servidor.
    }
  }

  private async getConsultarEmpleados(req: Request, res: Response) {
    try {
      let empleados = await db["Empleado"].findAll(); // Manda los datos de la tabla
      res.status(200).json(empleados);
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }

  private async postCrearEmpleado(req: Request, res: Response) {
    try {
      console.log(req.body);
      await db.Empleado.create(req.body); //Insert
      console.log("Empleado creado");
      res.status(200).send("<h1>Empleado creado</h1>");
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }
}

export default EmpleadoController;
